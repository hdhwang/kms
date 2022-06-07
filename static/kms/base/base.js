function confirmLogout() {
    showConfirmModal('확인', '로그아웃하시겠습니까?',
        function (result) {
            if (result === true) {
                location.href = '/logout';
            }
        }
    );
}

function showModal(title, message, callbackFunc = null) {
    if (title.length > 0 && message.length > 0) {
        let modal = '<div class="modal fade" id="notify-modal"><div class="modal-dialog"><div class="modal-content">' +
            '<div class="modal-header"><h4 class="modal-title" id="confirm-modal-title"></h4>' +
            '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>' +
            '<div class="modal-body" id="confirm-modal-body"><p></p></div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-primary" id="btn-ok" data-dismiss="modal">확인</button>' +
            '</div></div></div></div>';

        $('#main-contents').append(modal);

        $('#confirm-modal-title').text(title);  //타이틀 지정
        $('#confirm-modal-body').html(message); //메시지 지정

        //모달이 출력될 때 확인 버튼에 포커스
        $('#notify-modal').off('shown.bs.modal').on('shown.bs.modal', function () {
            $('#btn-ok').focus();
        });

        //모달이 닫힐 때 모달 폐기
        $('#notify-modal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
            $('#notify-modal').remove();
        });

        //확인 버튼 클릭 시 true 리턴
        $('#notify-modal').off('click', '#btn-ok').on('click', '#btn-ok', function () {
            if (callbackFunc) {
                callbackFunc();
            }

            $('#notify-modal').remove();
        });

        $('#notify-modal').attr('tabindex', -1);
        $('#notify-modal').modal({
            show: true,
            backdrop: 'static',
            keyboard: true
        });
    }
}

function showConfirmModal(title, message, callbackFunc) {
    if (title.length > 0 && message.length > 0) {
        let modal = '<div class="modal fade" id="confirm-modal"><div class="modal-dialog"><div class="modal-content"><div class="modal-header">' +
            '<h4 class="modal-title" id="confirm-modal-title""></h4>' +
            '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>' +
            '<div class="modal-body" id="confirm-modal-body"><p></p></div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-primary" id="btn-confirm-ok" data-dismiss="modal">확인</button>' +
            '<button type="button" class="btn btn-default pull-right" id="btn-confirm-cancel" data-dismiss="modal">취소</button>' +
            '</div></div></div></div>';

        $('#main-contents').append(modal);

        $('#confirm-modal-title').text(title);  //타이틀 지정
        $('#confirm-modal-body').html(message); //메시지 지정

        //확인 버튼에 포커스
        $('#confirm-modal').off('shown.bs.modal').on('shown.bs.modal', function () {
            $('#btn-confirm-ok').focus();
        });

        //모달이 닫힐 때 모달 폐기
        $('#confirm-modal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
            $('#confirm-modal').remove();
        });

        //확인 버튼 클릭 시 true 리턴
        $('#confirm-modal').off('click', '#btn-confirm-ok').on('click', '#btn-confirm-ok', function () {
            callbackFunc(true);
            $('#confirm-modal').remove();
        });

        $('#confirm-modal').attr('tabindex', -1);
        $('#confirm-modal').modal({
            show: true,
            backdrop: 'static',
            keyboard: true
        });
    }
}

// 비밀번호 입력 모달 출력
function showPasswordModal(message, callbackFunc) {
    message = (message !== null && message !== undefined || message !== '') ? message : '비밀번호를 입력해 주십시오.';
    let emptyMessage = '비밀번호를 입력해 주십시오.';

    let modal = '<div class="modal fade" id="modal-pw"><div class="modal-dialog vertical-align-center"><div class="modal-content"><div class="modal-header">' +
        '<h4 class="modal-title">비밀번호 확인</h4>' +
        '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>' +
        '<div class="modal-body">' +
        '<h1 align="center"><i class="fa fa-warning"></i></h1>' +
        '<h6 align="center" id="pw-modal-message"></h6>' +
        '<input type="password" id="input-pw" class="form-control" minlength="8" maxlength="120"/>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-primary" id="btn-pw-ok" data-dismiss="modal">확인</button>' +
        '<button type="button" class="btn btn-default pull-right" id="btn-pw-cancel" data-dismiss="modal">취소</button>' +
        '</div></div></div></div>';

    $('#main-contents').append(modal);
    $('#pw-modal-message').text(message); //메시지 지정

    //비밀번호 입력 input에 포커스
    $('#modal-pw').off('shown.bs.modal').on('shown.bs.modal', function () {
        $('#input-pw').focus();
    });

    //모달이 닫힐 때 모달 폐기
    $('#modal-pw').off('hidden.bs.modal').on('hidden.bs.modal', function () {
        $('#modal-pw').remove();
    });

    //패스워드 입력 input에서 엔터 키 입력 시
    $('#input-pw').keypress(function (e) {
        if (!$('#btn-pw-ok').attr('disabled') && e.which == 13) {
            changePWModalBtnStatus(false);      //확인 버튼 비활성화

            //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
            setTimeout(function () {
                if ($('#input-pw').val() === '') {
                    showModal('경고', emptyMessage);
                    changePWModalBtnStatus(true);   //확인 버튼 활성화
                }

                else {
                    callbackFunc($('#input-pw').val());
                }
            }, 500);
        }
    });

    //확인 버튼 클릭 시 true 리턴
    $('#modal-pw').off('click', '#btn-pw-ok').on('click', '#btn-pw-ok', function () {
        changePWModalBtnStatus(false);      //확인 버튼 비활성화
        const val = $('#input-pw').val();

        //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
        setTimeout(function () {
            if (val === '') {
                showModal('경고', emptyMessage);
                changePWModalBtnStatus(true);   //확인 버튼 활성화
            }

            else {
                callbackFunc(val);
            }
        }, 500);
    });

    $('#modal-pw').attr('tabindex', -1);
    $('#modal-pw').modal({
        show: true,
        backdrop: 'static',
        keyboard: true
    });
}

// 비밀번호 입력 모달 > 확인 버튼 활성화 / 비활성화
function changePWModalBtnStatus(enabled) {
    enabled = (enabled == false) ? true : false;
    $('#btn-pw-ok').attr('disabled', enabled);
}

// 비밀번호 입력 모달 닫기
function closePasswordModal() {
    if ($('#modal-pw').length > 0) {
        $('#modal-pw').modal('hide');
    }
}

//Form 데이터 전체 초기화
function clearFormData(target) {
    if (target !== null) {
        if ($(target).find('form') && $(target).find('form').length > 0) {
            $(target).find('form')[0].reset();
        }

        $(target).find('input').each(function () {
            if ($(this).attr('type') == 'checkbox') {
                $(this).prop('checked', false);
            }

            else {
                $(this).val();
            }
        });

        $(target).find('select').each(function () {
            $(this).children('option:eq(0)').prop('selected', true);
        });
    }

    initICheck();
}

//최대 길이 체크
function maxLengthCheck(object) {
    if (object.value.length > object.maxLength) {
        object.value = object.value.slice(0, object.maxLength);
    }
}

function getCookiePath() {
    return ';path=note';
}

//쿠키 설정
function setCookie(cookieName, value, exDays, setPath = false) {
    let expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + exDays);
    let cookieValue = escape(value) + ((exDays == null) ? "" : "; expires=" + expireDate.toGMTString());

    let cookie = cookieName + '=' + cookieValue;
    if (setPath == true) {
        cookie += getCookiePath();
    }
    document.cookie = cookie;
}

//쿠키 삭제
function deleteCookie(cookieName, setPath = false) {
    let expireDate = new Date();
    expireDate.setDate(expireDate.getDate() - 1);

    let delCookie = cookieName + '= ; expires=' + expireDate.toGMTString();
    if (setPath == true) {
        delCookie += getCookiePath();
    }
    document.cookie = delCookie;
}

//쿠키 조회
function getCookie(cookieName) {
    cookieName = cookieName + '=';
    let cookieData = document.cookie;
    let start = cookieData.indexOf(cookieName);
    let cookieValue = '';
    if (start != -1) {
        start += cookieName.length;
        let end = cookieData.indexOf(';', start);
        if (end == -1) {
            end = cookieData.length;
        }

        cookieValue = cookieData.substring(start, end);
    }
    return unescape(cookieValue);
}

//이메일 유효성 검증
function checkEmailValidation(inputText) {
    const emailRegex = /^[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/i;//이메일 정규식

    let emailList = inputText.split(';');
    for (let i in emailList) {
        if (!emailRegex.test(emailList[i])) {
            return false;
        }
    }

    return true;
}

//콤마찍기
function numberWithComma(num) {
    num = String(num);
    return num.replace(/(\d)(?=(?:\d{3})+(?!\d))/g, '$1,');
}

//숫자 여부 판단
function checkNumber(s) {
    s += ''; // 문자열로 변환
    s = s.replace(/^\s*|\s*$/g, ''); // 좌우 공백 제거
    if (s == '' || isNaN(s)) {
        return false;
    }

    return true;
}

//DateRangePicker 언어 설정 조회
function getDateRangePickerLocale(format = 'YYYY-MM-DD HH:mm') {
    return {
        format: format,
        separator: ' ~ ',
        customRangeLabel: '기간 설정',
        applyLabel: '적용',
        cancelLabel: '취소',
        monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
        daysOfWeek: ['일', '월', '화', '수', '목', '금', '토'],
    }
}

//DataTable 언어 설정 조회
function getDataTableLanguage(param = '') {
    let url = '/data-tables/korean';
    if (param != '') {
        url += param
    }

    return {
        url: url
    };
}

//iCheck 초기화
function initICheck() {
    //iCheck for checkbox and radio inputs
    $('input[type="checkbox"].square, input[type="radio"].square').iCheck({
        checkboxClass: 'icheckbox_square-blue',
        radioClass: 'iradio_square-blue'
    });

    $('input[type="checkbox"].minimal, input[type="radio"].minimal').iCheck({
        checkboxClass: 'icheckbox_minimal-blue',
        radioClass: 'iradio_minimal-blue'
    });

    $('input[type="checkbox"].flat, input[type="radio"].flat').iCheck({
        checkboxClass: 'icheckbox_flat-blue',
        radioClass: 'iradio_flat-blue'
    });

    //Flat green color scheme for iCheck
    $('input[type="checkbox"].flat-green, input[type="radio"].flat-green').iCheck({
        checkboxClass: 'icheckbox_flat-green',
        radioClass: 'iradio_flat-green'
    });
}

//검색 기간(초) 조회
function getDiffDateRange(dateRangePicker) {
    let startDate = dateRangePicker.data('daterangepicker').startDate;
    let endDate = dateRangePicker.data('daterangepicker').endDate;

    return (endDate - startDate) / 1000;
}

//Placeholder 설정
function setPlaceholder(context, placeholder = '') {
    context.prop('placeholder', placeholder);
}

//입력 최대 글자 수 설정
function setMaxLength(context, maxLength = 1024) {
    context.prop('maxlength', maxLength);
}

//키 입력 제한 설정
function setKeyPress(context, type = '') {
    context.off('keypress').on('keypress', function () {

        //숫자 또는 휴대폰 입력인 경우
        if (type == 'num' || type == 'mobile') {
            checkNumberKey();
        }

        //다중 숫자 입력인 경우
        else if (type == 'multiNum') {
            checkMultiNumberKey();
        }

        //IP 입력인 경우
        else if (type == 'ip') {
            checkIPKey();
        }

        else {
            checkAlphaNumSpecialKey();
        }
    });
}

//텍스트 박스에 숫자와 영문, 특수문자 입력 가능 설정
function checkAlphaNumSpecialKey() {
    const char = event.keyCode;

    if (char != 13 && checkKey() < 1 || checkKey() > 3) {
        event.returnValue = false;
        return;
    }
}

//텍스트 박스에 숫자만 입력 가능 설정
function checkNumberKey() {
    const char = event.keyCode;

    if (char != 13 && checkKey() != 1) {
        event.returnValue = false;
        return;
    }
}

//텍스트 박스에 숫자, 특수문자(,) 입력 가능 설정
function checkMultiNumberKey() {
    const char = event.keyCode;

    if (char != 13 && !(char == 44 || (char >= 48 && char <= 57))) {
        event.returnValue = false;
        return;
    }
}

//텍스트 박스에 숫자, 특수문자(.)만 입력 가능 설정
function checkIPKey() {
    const char = event.keyCode;

    if (char != 13 && !(char == 46 || (char >= 48 && char <= 57))) {
        event.returnValue = false;
        return;
    }
}

function checkKey() {
    const char = event.keyCode;

    //숫자
    if (char >= 48 && char <= 57) {
        return 1;
    }

    //영문
    else if ((char >= 65 && char <= 90) || (char >= 97 && char <= 122)) {
        return 2;
    }

    //특수기호
    else if ((char >= 33 && char <= 47) || (char >= 58 && char <= 64)
        || (char >= 91 && char <= 96) || (char >= 123 && char <= 126)) {
        return 3;
    }

    //한글
    else if ((char >= 12592) || (char <= 12687)) {
        return 4;
    }

    else {
        return -1;
    }
}

//키 입력 이벤트 제거
function removeKeyPress(context) {
    context.off('keypress');
}

//입력 불가능한 키 입력 시 공백으로 치환
function setKeyup(context, type = '', callbackFunc = null) {
    const regNum = /[0-9]/g;
    const regAlpha = /[A-Za-z]/g;
    const regSpecial = /[\{\}\[\]\/?.,;:|\)*~`!^\-+<>@\#$%&\\\=\(\'\"]/gi;
    const regHangul = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g;

    context.off('keyup').on('keyup', function (e) {
        //숫자 입력인 경우 숫자를 제외한 모든 문자를 공백으로 치환
        if (type == 'num') {
            $(this).val($(this).val().replace(regAlpha, ''));
            $(this).val($(this).val().replace(regSpecial, ''));
        }

        //다중 숫자 입력인 경우 숫자, 특수문자(,)를 제외한 모든 문자를 공백으로 치환
        else if (type == 'multiNum') {
            const regExp = /[\{\}\[\]\/?.;:|\)*~`!^\-+<>@\#$%&\\\=\(\'\"]/gi;

            $(this).val($(this).val().replace(regAlpha, ''));
            $(this).val($(this).val().replace(regExp, ''));
        }

        //휴대폰 입력인 경우 숫자를 제외한 모든 문자를 공백으로 치환
        else if (type == 'mobile') {
            $(this).val($(this).val().replace(regAlpha, ''));
            $(this).val($(this).val().replace(regSpecial, ''));

            //입력 값을 휴대폰 번호 형식으로 치환
            $(this).val(setAutoHypenMobile($(this).val()));
        }

        //IP 입력인 경우 숫자, 특수문자(.)를 제외한 모든 문자를 공백으로 치환
        else if (type == 'ip') {
            const regExp = /[\{\}\[\]\/?,;:|\)*~`!^\-+<>@\#$%&\\\=\(\'\"]/gi;

            $(this).val($(this).val().replace(regAlpha, ''));
            $(this).val($(this).val().replace(regExp, ''));
        }

        if (type != 'ship-addr') {
            //한글 입력을 공백으로 치환
            $(this).val($(this).val().replace(regHangul, ''));
        }

        //엔터 버튼을 클릭한 경우
        if (e.keyCode == 13 && callbackFunc != null) {
            callbackFunc();
        }
    });
}

// 로그인 페이지 리다이렉트 체크
function checkRedirectLoginPage(data, next = '') {
    let url = '/';
    if (next != '') {
        url += '?next=' + next;
    }

    //DataTables ajax
    if (data == 'parsererror') {
        location.replace(url);
    }

    //GET, POST 요청 시
    else if (data && data.request && data.request.responseURL && data.request.responseURL.indexOf('?next=') > -1) {
        location.replace(url);
    }

    //PUT 요청 오류 시
    else if (data.toString().indexOf('Error: Request failed with status code 500') > -1) {
        location.replace(url);
    }

    //DELETE 요청 오류 시
    else if (data.toString().indexOf('Error: Request failed with status code 405') > -1) {
        location.replace(url);
    }
}

// HTTP 상태 코드별 메시지 조회
function getHttpStatusMessage(status, item = '항목') {
    let msg = '';

    if (status == 401) {
        msg = '요청에 대한 권한이 없습니다.';
    }

    else if (status == 403) {
        msg = '요청에 대한 권한이 없습니다.';
    }

    else if (status == 404) {
        msg = '요청 페이지를 찾을 수 없습니다.';
    }

    else if (status == 405) {
        msg = '허용되지 않는 요청 방식입니다.';
    }

    else if (status == 409) {
        msg = '이미 존재하는 {0}입니다.'.replace('{0}', item);
    }

    else if (status == 500) {
        msg = '서버에 오류가 발생하였습니다.';
    }

    return msg;
}

// 통신비밀보호 > 데이터 조회 > 휴대폰 번호 입력 시 자동 하이픈 추가
function setAutoHypenMobile(str) {
    str = str.replace(/[^0-9]/g, '');
    let tmp = '';

    if (str.length < 4) {
        return str;
    }

    else if (str.length < 7) {
        tmp += str.substr(0, 3);
        tmp += '-';
        tmp += str.substr(3);

        return tmp;
    }
    else if (str.length < 11) {
        tmp += str.substr(0, 3);
        tmp += '-';
        tmp += str.substr(3, 3);
        tmp += '-';
        tmp += str.substr(6);

        return tmp;
    }

    else {
        tmp += str.substr(0, 3);
        tmp += '-';
        tmp += str.substr(3, 4);
        tmp += '-';
        tmp += str.substr(7);

        return tmp;
    }

    return str;
}

//새 탭으로 열기
function openInNewTab(url) {
    let win = window.open(url, '_blank');
    win.focus();
}

//오늘 일자 조회
function getToday() {
    let date = new Date();

    let month = date.getMonth() + 1;
    let day = date.getDate();

    return date.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
}

//DataTables 필드 항목 콤마로 구분 후 데이터 축약
function getDataTableEllipsis() {
    return function (data, type, row) {
        let splitData = data.split(',');
        const printCnt = 2;             //화면에 출력할 데이터 수
        let ellipsisData = '';          //화면 출력 수 초과 시 축약 데이터
        let orgData = '';               //툴팁에 출력하기 위한 개행 처리된 원본 데이터

        for (let i = 0; i < splitData.length; i++) {
            orgData += (orgData.length > 0) ? '\n' + splitData[i] : splitData[i];

            if (i < printCnt) {
                ellipsisData += (ellipsisData.length > 0) ? '<br>' + splitData[i] : splitData[i];
            }
        }

        if (splitData.length > printCnt) {
            ellipsisData += '<br>외 ' + (splitData.length - printCnt) + ' 개';
        }

        let html = '<div data-toggle="tooltip" title="' + orgData + '">' + ellipsisData + '</div>';

        return html;
    }
}

//XSS 관련 html 코드 치환
function escapeHtml(text) {
    if (text != null && text != undefined && typeof (text) == typeof '') {
        text = text.replace(/\</g, "&lt;");
        text = text.replace(/\>/g, "&gt;");
        text = text.replace(/\(/g, "&lpar;");
        text = text.replace(/\)/g, "&lrar;");
        text = text.replace(/\#/g, "&num;");
        text = text.replace(/\&/g, "&amp;");
        text = text.replace(/\'/g, "&aposl;");
        text = text.replace(/\"/g, "&quot;");
    }

    return text
}

function setSidebarCookie() {
    const cookieName = 'sidebar';
    const cookieValue = 'sidebar-collapse';
    let expireDate = 7;

    // 저장된 쿠키값 조회
    let cookie = getCookie(cookieName);

    if (cookie === cookieName) {
        deleteCookie(cookieName, true);
    }

    else {
        setCookie(cookieName, cookieValue, expireDate, true); // 7일 동안 쿠키 보관
    }
}

function changeSidebarStatus() {
    const cookieName = 'sidebar';
    const cookieValue = 'sidebar-collapse';

    // 저장된 쿠키값 조회
    let cookie = getCookie(cookieName);

    if (cookie === cookieValue) {
        $('#body').addClass(cookieValue);
    }

    else {
        $('#body').removeClass(cookieValue);
    }
}

function getDataTablesDom() {
    let dom = '<"row"<"col-sm-4"l><"col-sm-8"B>>'
        + '<"row"<"col-sm-4"i><"col-sm-8"p>>'
        + '<"row"<"col-sm-12"tr>>';

    return dom;
}

function getDataTablesOrder(data) {
    let column = data.order[0].column;
    let dir = (data.order[0].dir == 'desc') ? '-' : '';
    let order = (data.columns[column].data) ? data.columns[column].data : 'id';

    return { 'order': order, 'dir': dir };
}

function getDataTablesFilterColumns(data) {
    let result = [];

    for (let i = 0; i < data.columns.length; i++) {
        if (data.columns[i].search.value) {
            result.push({ 'data': data.columns[i].data, 'value': data.columns[i].search.value })
        }
    }

    return result;
}

//사용 불가 단어 검증
function checkWordValidation(inputText) {
    const arr = ['NONE'];
    for (let i in arr) {
        if (inputText.toUpperCase() == arr[i]) {
            return false;
        }
    }

    return true;
}

function checkJSONFormat(data) {
    if (typeof (data) == 'object') {
        try {
            data = JSON.stringify(data);
        }

        catch (e) {
            return false;
        }
    }

    if (typeof (data) == 'string') {
        try {
            data = JSON.parse(data);
        }

        catch (e) {
            return false;
        }
    }

    if (typeof (data) != 'object') {
        return false;
    }

    return true;
}

// 로컬 스토리지 데이터 조회
function getLocalStorageData(key) {
    let localStorageData = localStorage.getItem(key);

    return checkJSONFormat(localStorageData) ? JSON.parse(localStorageData) : localStorageData;
}

// 로컬 스토리지 데이터 설정
function setLocalStorageData(key, value) {
    if (key) {
        localStorage.setItem(key, (checkJSONFormat(value) == true) ? JSON.stringify(value) : value);

        return true;
    }

    return false;
}

// 로컬 스토리지 데이터 삭제
function removeLocalStorageData(key) {
    if (key && localStorage.getItem(key)) {
        localStorage.removeItem(key);

        return true;
    }

    return false;
}

$(function () {
    // CSRF 토큰을 쿠키가 아닌 base.html의 djagno 변수에서 조회
    const csrfToken = $('[name=csrfmiddlewaretoken]').val();
    axios.defaults.headers.common['X-CSRFToken'] = csrfToken;

    //Modal에 Drag & Drop 기능 추가
    $('.modal-dialog').draggable({ handle: ".modal-header" });
});