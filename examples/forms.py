"""Django-формы для примеров: рендерятся как jqxForm через ``form=``.

Виджет ``Form(source=..., form=ProductDjangoForm)`` берёт из формы поля,
подписи (verbose_name модели + label_suffix), обязательность, список
категорий (FK -> dropdown) и подсказку help_text.
"""
from django import forms

from .models import Product


class ProductDjangoForm(forms.ModelForm):
    """Форма товара: подпись «Название» и подсказка заданы явно,
    остальные поля и подписи («Цена», «Категория», «В наличии»)
    берутся из модели."""

    name = forms.CharField(
        label='Название',
        max_length=255,
        help_text='Например: «Война и мир»',
    )

    class Meta:
        model = Product
        # created_at (auto_now_add) в форму не попадает: поле не редактируемое
        fields = ('name', 'price', 'category', 'in_stock')
