"""Базовый класс viewset-фабрик jqxWidgets: общее для грида, дерева и формы."""

from rest_framework.mixins import CreateModelMixin

from ..router import router
from ..utils import resolve_model


class BaseViewSet:
    """Общие поля и методы ``GridViewSet`` и ``TreeViewSet``.

    * **Реестр** — созданные viewset'ы и занятые basename'ы. Реестр и
      basename'ы общие для всех наследников: роутер у пакета один, поэтому
      грид и дерево одной модели получают разные basename'ы автоматически
      (без перекрёстных ссылок между классами).
    * **Фабрика** ``create()`` — резолв модели, кэш повторного вызова,
      сборка опций (шаблонный метод ``_build_options()``), регистрация
      в роутере. Специфичные параметры каждого вида описаны в
      :meth:`GridViewSet.create` и :meth:`TreeViewSet.create`.
    * **``extra``** — доп. опции источника, накладываемые на
      ``<source>config/`` (см. :meth:`_apply_extra`).

    Тип фабрики задаётся ``_kind`` (``'grid'`` / ``'tree'``): по нему
    строится ключ реестра, имя класса и имена атрибутов создаваемого
    viewset'а (``grid_basename``/``grid_model`` либо
    ``tree_basename``/``tree_model`` — их читает ``source_url``).
    """

    # Общие атрибуты источника
    extra: dict | None = None

    # Тип фабрики: задаёт ключ реестра, имя класса и имена атрибутов
    _kind: str = 'base'

    # Реестр созданных viewset'ов: '<kind>:<app_label>.<model_name>' -> класс
    _registry: dict = {}
    # Basename'ы, занятые в общем роутере (гриды, деревья и формы вместе)
    _registered_basenames: set = set()
    # Префиксы URL, занятые в общем роутере: одна модель может иметь грид,
    # дерево и форму — каждый со своим viewset'ом и URL
    _registered_prefixes: set = set()

    # ------------------------------------------------------------------
    # Реестр
    # ------------------------------------------------------------------
    @classmethod
    def exists(cls, basename: str) -> bool:
        """True, если basename уже занят в общем роутере."""
        return basename in cls._registered_basenames

    @classmethod
    def _registry_key(cls, model) -> str:
        """Ключ реестра: тип фабрики + модель.

        ``_kind`` в ключе — чтобы грид и дерево одной модели считались
        разными источниками (как раньше, когда у классов были отдельные
        реестры).
        """
        meta = model._meta
        return f'{cls._kind}:{meta.app_label}.{meta.model_name}'

    # ------------------------------------------------------------------
    # Фабрика
    # ------------------------------------------------------------------
    @classmethod
    def create(cls, model, name=None, *, queryset=None, extra=None, **attrs):
        """Создать и зарегистрировать viewset для модели.

        :param model: класс модели или её имя (``"MyModel"``, ``"app.MyModel"``);
        :param name: префикс URL (по умолчанию — имя модели);
        :param queryset: свой queryset (по умолчанию ``model.objects.all()``);
        :param extra: дополнительные опции виджета для ``<source>config/``;
        :param attrs: параметры конкретного вида — ``serializer_class`` у
            грида, ``parent_field``/``chunk_size`` у дерева и т.п.
            (см. ``GridViewSet.create`` / ``TreeViewSet.create``);
        :return: класс viewset'а (передавайте в ``Grid(source=...)`` или
            ``Tree(source=...)``).
        """
        resolved = resolve_model(model)
        registry_key = cls._registry_key(resolved)
        if registry_key in cls._registry:
            return cls._registry[registry_key]

        prefix = name or resolved._meta.model_name
        # Дедупликация префикса: у одной модели может быть грид, дерево и
        # форма — каждый со своим viewset'ом (иначе маршруты перекрываются:
        # первый зарегистрированный «съедает» URL другого).
        if prefix in cls._registered_prefixes:
            prefix = f'{prefix}-{cls._kind}'
        basename = resolved._meta.model_name
        # Дедупликация basename'а в общем роутере: гриды и деревья вместе.
        if cls.exists(basename):
            basename = f'{resolved._meta.app_label}_{basename}'

        viewset = type(
            f'{resolved.__name__}{cls._kind.capitalize()}ViewSet',
            (cls,),
            cls._build_options(resolved, queryset=queryset, extra=extra, **attrs),
        )
        # Атрибуты, по которым Grid/Tree/Form находят URL источника (source_url)
        setattr(viewset, f'{cls._kind}_basename', basename)
        setattr(viewset, f'{cls._kind}_model', resolved)

        router.register(prefix, viewset, basename=basename)
        cls._registry[registry_key] = viewset
        cls._registered_basenames.add(basename)
        cls._registered_prefixes.add(prefix)
        return viewset

    # ------------------------------------------------------------------
    # HTTP-диспетчеры
    # ------------------------------------------------------------------
    @classmethod
    def as_view(cls, actions=None, **initkwargs):
        """Перебиндить POST: фабрика ``create()`` затеняет действие DRF.

        Роутер видит ``create`` — фабрику создания viewset'а — и биндит на
        неё POST-диспетчер, из-за чего запрос падал бы с TypeError
        (``resolve_model(request)``). POST роутится на ``create_object``,
        если класс миксина ``CreateModelMixin`` входит в его MRO (грид,
        форма), либо не биндится вовсе — тогда POST на дерева вернёт 405.
        """
        if actions and actions.get('post') == 'create':
            actions = dict(actions)
            if any(base is CreateModelMixin for base in cls.__mro__):
                actions['post'] = 'create_object'
            else:
                del actions['post']
        return super().as_view(actions, **initkwargs)

    def create_object(self, request, *args, **kwargs):
        """POST: создать запись.

        Действие DRF переименовано из ``create``: имя занято фабрикой
        :meth:`create` (см. :meth:`as_view`). Доступно только классам с
        ``CreateModelMixin`` (``ModelViewSet``).
        """
        return CreateModelMixin.create(self, request, *args, **kwargs)

    # ------------------------------------------------------------------
    # Хуки для наследников
    # ------------------------------------------------------------------
    @classmethod
    def _build_options(cls, model, *, queryset, extra, **attrs) -> dict:
        """Опции класса создаваемого viewset'а (общая часть).

        Наследники добавляют свои ключи: ``super()`` + ``update()``.
        """
        return {
            'queryset': queryset if queryset is not None else model.objects.all(),
            'extra': extra,
            **attrs,
        }

    def _apply_extra(self, config: dict) -> dict:
        """Наложить ``extra`` фабрики на конфигурацию ``<source>config/``."""
        if self.extra:
            config.update(self.extra)
        return config
