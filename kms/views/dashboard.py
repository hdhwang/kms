import logging

from django.http import JsonResponse, HttpResponse
from django.views.generic import TemplateView, View

from kms import models
from utils.dic_helper import insert_dic_data
from utils.format_helper import to_str

logger = logging.getLogger(__name__)


# 대시보드
class DashboardView(TemplateView):
    template_name = "kms/dashboard.html"
    context = {}

    def get(self, request, *args, **kwargs):
        return self.render_to_response(self.context)


# 키 수 조회
class DashboardAPI(View):
    def get(self, request):
        try:
            filter_params = {}

            # 요청 사용자가 관리자가 아닌 경우 WHERE 절에 사용자 ID 추가
            if request.user.is_superuser == 0:
                insert_dic_data(filter_params, "user_id", request.user.id)

            return JsonResponse(
                {"count": models.Keyinfo.objects.filter(**filter_params).count()}
            )

        except Exception as e:
            logger.warning(f"[DashboardAPI - get] {to_str(e)}")
            return HttpResponse(status=400)
