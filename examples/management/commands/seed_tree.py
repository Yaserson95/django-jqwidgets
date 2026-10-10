"""Наполнение БД древовидной структурой для примера jqxTree."""
from django.core.management.base import BaseCommand

from examples.models import Node

ROOTS = 20          # обычные корневые разделы
CHILDREN = 15       # детей у обычного раздела
BIG = 300           # детей у «Большого раздела» (прокрутка: 300 > chunk_size=50)
DEEP_FANOUT = 3     # ветвление «Глубокого раздела»
DEEP_LEVELS = 4     # уровней в глубину


class Command(BaseCommand):
    help = 'Создаёт древовидную структуру (Node) для примера jqxTree'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true',
                            help='Удалить существующие узлы перед созданием')

    def handle(self, *args, **options):
        if options['clear']:
            Node.objects.all().delete()
            self.stdout.write('Старые узлы удалены.')

        created = 0

        # 1. Обычные разделы: корень + CHILDREN детей.
        for i in range(1, ROOTS + 1):
            root = Node.objects.create(name=f'Раздел {i:02d}')
            created += 1
            for j in range(1, CHILDREN + 1):
                Node.objects.create(name=f'Подраздел {i:02d}.{j:02d}', parent=root)
                created += 1

        # 2. Широкий раздел: BIG детей — демонстрация подгрузки чанков
        #    при прокрутке (все 300 не отдаются одним запросом).
        big = Node.objects.create(name='Большой раздел (300 узлов)')
        created += 1
        for j in range(1, BIG + 1):
            Node.objects.create(name=f'Элемент {j:03d}', parent=big)
            created += 1

        # 3. Глубокий раздел: цепочка уровней с ветвлением DEEP_FANOUT.
        deep = Node.objects.create(name='Глубокий раздел')
        created += 1
        level = [deep]
        for depth in range(1, DEEP_LEVELS + 1):
            next_level = []
            for parent in level:
                for j in range(1, DEEP_FANOUT + 1):
                    child = Node.objects.create(
                        name=f'Уровень {depth}.{j} ({parent.name})', parent=parent,
                    )
                    created += 1
                    next_level.append(child)
            level = next_level

        self.stdout.write(self.style.SUCCESS(
            f'Готово: узлов {Node.objects.count()} (создано {created}).'
        ))
