"""URL configuration for the example project."""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # REST-эндпоинты viewset'ов, зарегистрированных GridViewSet.create()
    path('api/', include('jqxwidgets.urls')),
    # Примеры виджетов
    path('', include('examples.urls')),
]
