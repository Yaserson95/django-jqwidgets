from django.urls import path

from . import views

app_name = 'examples'

urlpatterns = [
    path('', views.index, name='index'),
    path('auto-columns/', views.auto_columns, name='auto_columns'),
    path('explicit-columns/', views.explicit_columns, name='explicit_columns'),
    path('custom-options/', views.custom_options, name='custom_options'),
    path('combined/', views.combined, name='combined'),
]
