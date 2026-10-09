"""URL-ы пакета django-jqwidgets.

Роутер наполняется динамически (``GridViewSet.create()``), поэтому urlpatterns
отдаются лениво — порядок ``include()`` и вызовы ``create()`` не важны.
"""
from django.urls import include, path

from .router import router


class _JqxwidgetsUrls:
    app_name = 'jqxwidgets'

    @property
    def urlpatterns(self):
        return router.urls


urlpatterns = [
    path('', include(_JqxwidgetsUrls())),
]
