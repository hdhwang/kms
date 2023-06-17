'use strict';

const errMsg = '조회 오류';
const baseUrl = '/dashboard/api/';

// 중지를 위해 타이머 ID 보관
let keyInfoTimerId = null;

const interval = 5000;

function getKeyInfoCount() {
    axios.get(baseUrl + 'keyinfo').then(function (response) {
        checkRedirectLoginPage(response, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

        if (response.data && response.data.count >= 0) {
            const count = response.data.count;
            $('.overlay').hide();
            $('#keyinfo').html(numberWithComma(count));
        }
    }).catch(function (error) {
        $('.overlay').hide();
        $('#keyinfo').html(errMsg);
    });
}

function checkEmptyData(itemList) {
    for (let i = 0; i < itemList.length; i++) {
        if (itemList[i].length > 0) {
            return false;
        }
    }

    return true;
}

function setEmptyData() {
    $('#dashboard').append('<div class="col-lg-12 text-muted"><h4>대시보드에 출력할 데이터가 없습니다.</h4></div>');
}

$(function () {
    const itemList = [$('#keyinfo')];

    //출력할 대시보드 데이터가 없는 경우
    if (checkEmptyData(itemList)) {
        setEmptyData();
    }

    //출력할 대시보드 데이터가 존재하는 경우
    else {
        // 키 수 조회
        if ($('#keyinfo').length > 0) {
            getKeyInfoCount();
            keyInfoTimerId = setInterval(function () {
                getKeyInfoCount();
            }, interval);
        }
    }
});