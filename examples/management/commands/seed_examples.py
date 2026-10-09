"""Наполнение БД тестовыми данными для примеров виджетов."""
import random
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from examples.models import Category, Product

CATEGORIES = [
    ('Электроника', 'Смартфоны, ноутбуки и аксессуары', 10),
    ('Продукты', 'Продукты питания и напитки', 9),
    ('Одежда', 'Мужская и женская одежда', 8),
    ('Спорт', 'Товары для спорта и отдыха', 7),
    ('Книги', 'Художественная и техническая литература', 6),
    ('Дом', 'Товары для дома и сада', 5),
]

NAME_PARTS = [
    ('Смартфон', 'Электроника'), ('Ноутбук', 'Электроника'), ('Наушники', 'Электроника'),
    ('Кофе', 'Продукты'), ('Чай', 'Продукты'), ('Шоколад', 'Продукты'),
    ('Куртка', 'Одежда'), ('Футболка', 'Одежда'), ('Джинсы', 'Одежда'),
    ('Мяч', 'Спорт'), ('Коврик', 'Спорт'), ('Гантели', 'Спорт'),
    ('Роман', 'Книги'), ('Учебник', 'Книги'), ('Справочник', 'Книги'),
    ('Лампа', 'Дом'), ('Чайник', 'Дом'), ('Комод', 'Дом'),
]


class Command(BaseCommand):
    help = 'Создаёт тестовые категории и товары для примеров виджетов'

    def add_arguments(self, parser):
        parser.add_argument('--products', type=int, default=120,
                            help='Количество товаров (по умолчанию 120)')
        parser.add_argument('--clear', action='store_true',
                            help='Удалить существующие данные перед созданием')

    def handle(self, *args, **options):
        if options['clear']:
            Product.objects.all().delete()
            Category.objects.all().delete()
            self.stdout.write('Старые данные удалены.')

        categories = {}
        for name, description, priority in CATEGORIES:
            category, _ = Category.objects.get_or_create(
                name=name,
                defaults={'description': description, 'priority': priority},
            )
            categories[name] = category

        created = 0
        rng = random.Random(42)  # воспроизводимые данные для тестов
        for i in range(options['products']):
            base_name, category_name = NAME_PARTS[i % len(NAME_PARTS)]
            name = f'{base_name} {i + 1}'
            price = Decimal(rng.randrange(100, 50000)) / 100
            Product.objects.create(
                name=name,
                price=price,
                category=categories[category_name],
                in_stock=rng.random() > 0.3,
                # created_at — auto_now_add, имитируем разброс дат после создания
            )
            created += 1

        # Разброс дат создания, чтобы сортировка по дате была наглядна
        qs = Product.objects.order_by('id')
        now = timezone.now()
        for offset, product in enumerate(qs):
            product.created_at = now - timezone.timedelta(days=offset % 90)
        Product.objects.bulk_update(qs, ['created_at'])

        self.stdout.write(self.style.SUCCESS(
            f'Готово: категорий {Category.objects.count()}, товаров {Product.objects.count()} '
            f'(создано {created}).'
        ))
