from rest_framework.pagination import PageNumberPagination


class GridPagination(PageNumberPagination):
    """Пагинация для jqxGrid.

    jqxGrid передаёт номер страницы в параметре ``pagenum`` (нумерация с нуля)
    и размер страницы в ``pagesize``.
    """
    page_query_param = 'pagenum'
    page_size_query_param = 'pagesize'
    max_page_size = 50

    def get_page_number(self, request, paginator):
        page = request.query_params.get(self.page_query_param)
        if page is None:
            return 1
        if page in self.last_page_strings:
            return paginator.num_pages
        try:
            return int(page) + 1
        except (TypeError, ValueError):
            return 1
