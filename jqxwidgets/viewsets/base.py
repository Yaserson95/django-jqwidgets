"""Базовый класс viewset-фабрик jqxWidgets: общее для грида и дерева."""

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
    # Basename'ы, занятые в общем роутере (гриды и деревья вместе)
    _registered_basenames: set = set()

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
        basename = resolved._meta.model_name
        # Дедупликация basename'а в общем роутере: гриды и деревья вместе.
        if cls.exists(basename):
            basename = f'{resolved._meta.app_label}_{basename}'

        viewset = type(
            f'{resolved.__name__}{cls._kind.capitalize()}ViewSet',
            (cls,),
            cls._build_options(resolved, queryset=queryset, extra=extra, **attrs),
        )
        # Атрибуты, по которым Grid/Tree находят URL источника (source_url)
        setattr(viewset, f'{cls._kind}_basename', basename)
        setattr(viewset, f'{cls._kind}_model', resolved)

        router.register(prefix, viewset, basename=basename)
        cls._registry[registry_key] = viewset
        cls._registered_basenames.add(basename)
        return viewset

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
