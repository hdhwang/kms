from django.contrib.auth import views as auth_view
from django.contrib.auth.decorators import login_required
from django.urls import path
from django.views.generic.base import RedirectView

from kms.views import views, audit_log, account, dashboard, acl, api, keyinfo

urlpatterns = [
    # 로그인 관련 URL (로그인, 로그아웃)
    path("", views.IndexView.as_view(), name="index"),
    path("error-login", views.ErrorLoginView.as_view(), name="error_login"),
    path("400", views.error_400, name="error_400"),
    path("401", views.error_401, name="error_401"),
    path("403", views.error_403, name="error_403"),
    path("404", views.error_404, name="error_404"),
    path("500", views.error_500, name="error_500"),
    path("login", views.KMSLoginView.as_view(), name="login"),
    path("logout/", views.KMSLogoutView.as_view(), name="logout"),
    # 비밀번호 변경
    path(
        "account/",
        login_required(
            auth_view.PasswordChangeView.as_view(
                template_name="kms/account/account.html"
            )
        ),
        name="account",
    ),
    path(
        "password-change-done/",
        login_required(account.PasswordChangeDoneView.as_view()),
        name="password_change_done",
    ),
    # favicon
    path(
        "favicon.ico", RedirectView.as_view(url="/static/favicon.ico", permanent=True)
    ),
    # KMS 관련 URL
    # DataTables 한국어 json
    path("data-tables/korean", login_required(views.DataTablesKoreanView.as_view())),
    # 대시보드
    path(
        "dashboard", login_required(dashboard.DashboardView.as_view()), name="dashboard"
    ),
    path("dashboard/api/keyinfo", login_required(dashboard.DashboardAPI.as_view())),
    # 키 관리
    path("keyinfo", login_required(keyinfo.KeyInfoView.as_view()), name="keyinfo"),
    path("keyinfo/user/api", login_required(keyinfo.UserAPI.as_view())),
    path("keyinfo/user/api/<str:key>", login_required(keyinfo.UserAPI.as_view())),
    path("keyinfo/user/check", login_required(keyinfo.CheckKeyUserAPI.as_view())),
    path("keyinfo/user/value", login_required(keyinfo.ValueUserAPI.as_view())),
    path("keyinfo/admin/api", login_required(keyinfo.AdminAPI.as_view())),
    path("keyinfo/admin/api/<str:key>", login_required(keyinfo.AdminAPI.as_view())),
    path("keyinfo/admin/check", login_required(keyinfo.CheckKeyAdminAPI.as_view())),
    path("keyinfo/admin/value", login_required(keyinfo.ValueAdminAPI.as_view())),
    # 관리자 기능
    # 계정 관리 > 사용자 관리
    path(
        "account/users",
        login_required(account.UsersView.as_view()),
        name="account_users",
    ),
    path("account/users/api", login_required(account.UsersAPI.as_view())),
    path("account/users/api/<int:req_id>", login_required(account.UsersAPI.as_view())),
    path(
        "account/users/check/<str:username>",
        login_required(account.CheckUserAPI.as_view()),
    ),
    # 계정 관리 > 토큰 관리
    path(
        "account/token",
        login_required(account.TokenView.as_view()),
        name="account_token",
    ),
    path("account/token/api", login_required(account.TokenAPI.as_view())),
    path("account/token/api/<str:req_key>", login_required(account.TokenAPI.as_view())),
    # API 접근 제어 > IP 접근 제어
    path("acl/ip-addr", login_required(acl.IPAddrView.as_view()), name="acl_ip_addr"),
    path("acl/ip-addr/api", login_required(acl.IPAddrAPI.as_view())),
    path("acl/ip-addr/api/<int:req_id>", login_required(acl.IPAddrAPI.as_view())),
    # 시스템 설정
    path(
        "keyinfo/settings",
        login_required(keyinfo.KeyInfoSettingView.as_view()),
        name="keyinfo_settings",
    ),
    path("keyinfo/settings/api", login_required(keyinfo.KeyInfoSettingsAPI.as_view())),
    # 감사 로그
    path(
        "audit-log", login_required(audit_log.AuditLogView.as_view()), name="audit_log"
    ),
    path("audit-log/api", login_required(audit_log.AuditLogAPI.as_view())),
    # api
    path("api", api.api, name="api"),
]
