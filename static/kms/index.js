function loginClickEvent() {
    if ($.trim($('#user-id').val()) == '') {
        showModal('경고', '아이디를 입력해 주십시오.');
    }

    else if ($.trim($('#user-password').val()) == '') {
        showModal('경고', '비밀번호를 입력해 주십시오.');
    }

    else {
        let param = new FormData();
        param.append('user-id', $('#user-id').val());
        param.append('user-password', $('#user-password').val());
        param.append('user-confirm', 'N');

        tryLogin(param);
    }
}

function tryLogin(param) {
    axios(
        {
            method: 'POST',
            url: '/kms/login',
            data: param,
        })
        .then(function (response) {
            if (response) {
                //계정이 일정 시간동안 잠긴 경우
                if (response.request && response.request.responseURL && response.request.responseURL.toString().indexOf('/error_login') > -1) {
                    window.location = response.request.responseURL;
                }

                else if (response.data) {
                    //로그인에 성공한 경우
                    if (response.data.data == 1) {
                        window.location = window.location.origin + $('#next').val();
                    }

                    //기존 세션이 존재하는 경우
                    else if (response.data.data == 2) {
                        showConfirmModal('확인', '현재 접속 중인 계정입니다. 접속을 종료하고 로그인 하시겠습니까?',
                            function (result) {
                                if (result === true) {
                                    param.set('user-confirm', 'Y');
                                    tryLogin(param);
                                }
                            }
                        );
                    }

                    //비활성 계정인 경우
                    else if (response.data.data == -1) {
                        showModal('알림', '비활성 계정입니다. 관리자에게 문의하시기 바랍니다.');
                    }

                    //로그인에 실패한 경우
                    else {
                        showModal('알림', '아이디 또는 비밀번호가 일치하지 않습니다.');
                    }
                }

                else {
                    showModal('알림', '로그인에 실패하였습니다.');
                }
            }

            else {
                showModal('알림', '로그인에 실패하였습니다.');
            }
        })
        .catch(function (error) {
            showModal('알림', '로그인에 실패하였습니다.');
            // console.log(error);
        });
}

$(function () {
    // CSRF 토큰을 쿠키가 아닌 base.html의 djagno 변수에서 조회
    const csrfToken = $('[name=csrfmiddlewaretoken]').val();
    axios.defaults.headers.common['X-CSRFToken'] = csrfToken;

    if ($(location).attr('href').indexOf('?next=') > -1) {
        showModal('알림', '세션 정보가 만료되었습니다. 다시 로그인해 주십시오.');
    }

    // 저장된 쿠키값을 가져와서 아이디 칸에 넣어준다. 없으면 공백으로 들어감.
    let key = getCookie('key');
    let expiredDate = 7;

    $('#user-id').val(key);

    // 그 전에 아이디를 저장해서 처음 페이지 로딩 시, 입력 칸에 저장된 아이디가 표시된 상태라면,
    if ($('#user-id').val() != '') {
        $('#id-save-check').iCheck('check');    // 아이디 저장 체크 상태로 두기

        //출력된 모달이 없는 경우 비밀번호에 포커스
        if ($('#modal').length == 0) {
            $('#user-password').focus();
        }
    }
    else {
        //출력된 모달이 없는 경우 아이디에 포커스
        if ($('#modal').length == 0) {
            $('#user-id').focus();
        }
    }

    $('#id-save-check').off('ifChanged').on('ifChanged', function (event)     // 체크박스에 변화가 있다면,
    {
        if (event.target.checked)                           // 아이디 저장 체크했을 때,
        {
            setCookie('key', $('#user-id').val(), expiredDate); // 7일 동안 쿠키 보관
        }

        else                                                // 아이디 저장 체크 해제 시,
        {
            deleteCookie('key');
        }
    });

    // 아이디 저장을 체크한 상태에서 아이디를 입력하는 경우에도 쿠키 저장.
    $('#user-id').keyup(function ()                 // 아이디 입력 칸에 아이디를 입력할 때,
    {
        if ($('#id-save-check').is(':checked'))     // 아이디 저장 체크했을 때,
        {
            setCookie('key', $('#user-id').val(), expiredDate); // 7일 동안 쿠키 보관
        }
    });

    //아이디 입력 창에 엔터 클릭 이벤트 추가
    $('#user-id, #user-password').off('keypress').on('keypress', function () {
        const char = event.keyCode;

        if (char == 13) {
            loginClickEvent();
        }
    });

    //로그인 버튼에 클릭 이벤트 추가
    $('#login-btn').off('click').on('click', function () {
        loginClickEvent();
    });
});