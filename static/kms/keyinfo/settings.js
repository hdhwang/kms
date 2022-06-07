'use strict';

const requestUrl = '/keyinfo/settings/api';   //API URL
let initChecks = [];

//데이터 테이블 초기화
function initDataTable() {
    //DataTable 설정
    let table = $('#table-data').DataTable({
        autoWidth: false,
        responsive: true,
        processing: true,                       //처리 중 화면 출력
        serverSide: true,                       //serverSide 설정을 통해 해당 페이지 데이터만 조회
        language: getDataTableLanguage(),       //언어 설정
        ajax: {
            type: 'GET',
            url: requestUrl,
            data: function (data) {              //조회 파라미터
                delete data.columns;
            },
            error: function (xhr, error, thrown) {
                checkRedirectLoginPage(error, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = getHttpStatusMessage(xhr.status) != '' ? getHttpStatusMessage(xhr.status) : '오류가 발생하였습니다. 잠시 후 다시 시도해 주십시오.';
                toastr.error(msg);
                $('#table-data_processing').hide();
            }
        },
        deferRender: true,
        columns: [                              //출력할 컬럼 정보
            { className: 'dt-center', data: 'description', defaultContent: '', render: $.fn.dataTable.render.text(), orderable: false },
            {
                className: 'dt-center',
                data: 'value',
                defaultContent: '',
                render: function (data, type, row) {
                    data = escapeHtml(data);
                    let html = '<input type="checkbox" name=value-switch id="' + row.id + '" data-bootstrap-switch';
                    if (data == 'Y') {
                        html += ' checked'
                    }
                    html += '>'
                    return html;
                },
                orderable: false
            },
        ],
        dom: '<"row"<"col-sm-12"B>><"row"<"col-sm-12"tr>>',
        order: false,                           //정렬기능 비활성화
        drawCallback: function (settings, json)  //조회 완료 후 처리
        {
            initChecks = [];

            //활성화 스위치 기능 추가
            $('input[data-bootstrap-switch]').each(function () {
                $(this).bootstrapSwitch('state', $(this).prop('checked'));

                //스위치 변경 이벤트
                $(this).off('switchChange.bootstrapSwitch').on('switchChange.bootstrapSwitch', function (event, state) {
                    checkValue();
                });

                let value = $(this).is(':checked') ? 'Y' : 'N';
                initChecks.push(value);
            });

            //저장 버튼 비활성화
            $('#btn-ok').prop('disabled', true);
        },
        buttons: [
            {
                name: 'refresh',
                text: '<i class="fa fa-redo"></i> 새로고침',
                action: function () {
                    //새로고침 수행 시 데이터 조회
                    reloadTable();
                }
            }
        ]
    });
}

function reloadTable() {
    //DataTable 조회 수행
    $('#table-data').DataTable().ajax.reload();
}

function checkValue() {
    let currentValue = new Array();
    let result = false;
    $('input:checkbox').each(function () {
        let value = $(this).is(':checked') ? 'Y' : 'N';
        currentValue.push(value);
    });

    for (let i = 0, j = currentValue.length; i < j; i++) {
        if (currentValue[i] !== initChecks[i]) {
            result = true;
            break;
        }
    }

    if (result) {
        $('#btn-ok').removeAttr('disabled');
    }
    else {
        $('#btn-ok').prop('disabled', true);
    }
}

function updateData(password) {
    let checks = $('input:checkbox');
    let param = new FormData();

    param.append('pw', password);
    checks.each(function () {
        let id = $(this).attr('id');
        let value = $(this).is(':checked') ? 'Y' : 'N';
        param.append('id', id);
        param.append('value', value);
    });

    axios(
        {
            method: 'PUT',
            url: requestUrl,
            data: param,
        })
        .then(function (response) {
            if (response && response.status == 204) {
                closePasswordModal();
                toastr.success('시스템 설정 편집에 성공하였습니다.');
                reloadTable();
            }
            else {
                let msg = '시스템 설정 편집에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
                changePWModalBtnStatus();
            }

        })
        .catch(function (error) {
            let msg = '시스템 설정 편집에 실패하였습니다.'

            if (error.response.status == 401) {
                msg += ' 비밀번호가 일치하지 않습니다.';
            }

            else {
                msg += ' ' + getHttpStatusMessage(error.response.status);
            }

            toastr.error(msg);
            changePWModalBtnStatus();
        });
}

$(function () {
    initDataTable();

    $('#btn-ok').off('click').on('click', function () {
        //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
        setTimeout(function () {
            showPasswordModal('시스템 설정 편집을 위해 비밀번호를 입력하십시오.', updateData);
        }, 500);
    });
});