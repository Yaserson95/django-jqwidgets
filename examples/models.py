from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=255, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    priority = models.IntegerField(default=0, verbose_name='Приоритет')

    class Meta:
        verbose_name = 'Категория'
        verbose_name_plural = 'Категории'
        ordering = ['-priority', 'name']

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=255, verbose_name='Название')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Цена')
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name='products', verbose_name='Категория',
    )
    in_stock = models.BooleanField(default=True, verbose_name='В наличии')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')

    class Meta:
        verbose_name = 'Товар'
        verbose_name_plural = 'Товары'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Node(models.Model):
    """Узел древовидной структуры (самоссылка) для примера jqxTree."""
    name = models.CharField(max_length=255, verbose_name='Название')
    parent = models.ForeignKey(
        'self', null=True, blank=True, related_name='children',
        on_delete=models.CASCADE, verbose_name='Родитель',
    )
    priority = models.IntegerField(default=0, verbose_name='Приоритет')

    class Meta:
        verbose_name = 'Узел дерева'
        verbose_name_plural = 'Узлы дерева'
        ordering = ['priority', 'name']

    def __str__(self):
        return self.name
