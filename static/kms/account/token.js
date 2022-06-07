'use strict';

const requestUrl = '/account/token/api';   //API URL
const requestTokenlessUserUrl = '/account/users/tokenless/api';          // 토큰 발행하지 않은 사용자 목록 조회 및 설정

//데이터 테이블 초기화
function initDataTable() {
    //DataTable 설정
    let table = $('#table-data').DataTable({
        autoWidth: false,
        responsive: true,                       //테이블 반응형설정
        processing: true,                       //처리 중 화면 출력
        serverSide: true,                       //serverSide 설정을 통해 해당 페이지 데이터만 조회
        language: getDataTableLanguage(),       //언어 설정
        ajax: {
            type: 'GET',
            url: requestUrl,
            data: function (data) {              //조회 파라미터
                data.order = getDataTablesOrder(data);
                data.filter = getDataTablesFilterColumns(data);
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
            {
                className: 'dt-center',
                data: 'key',
                defaultContent: '',
                render: function (data, type) {
                    data = escapeHtml(data);
                    if (type === 'display') {
                        const id = 'radio-' + data;
                        return '<div class="icheck-primary"><input type="radio" name="selected-token" id="' + id +
                            '" value="' + data + '"><label for="' + id + '"></label></div>';
                    }
                    return data;
                },
                orderable: false
            },
            {
                className: 'dt-center',
                data: null,
                defaultContent: '',
                render: function (data, type, row, meta) {
                    return meta.settings._iDisplayStart + meta.row + 1;
                },
                orderable: false
            },
            { className: 'dt-center', data: 'user_id__username', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center', data: 'key', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center', data: 'created_date', defaultContent: '', render: $.fn.dataTable.render.text() },
        ],
        rowId: 'user_id__username',
        dom: getDataTablesDom(),
        lengthMenu: [[10, 20, 50], [10, 20, 50]],                 //페이지 당 갯수
        order: [[4, 'desc']],                                    //조회 시 생성 일자 기준 기본 정렬
        drawCallback: function (settings, json)                    //조회 완료 후 처리
        {
            //iCheck 초기화
            initICheck();

            // 검색 필터에 이벤트 추가
            $('.dataTables_filter input').unbind();
            $('.dataTables_filter input').bind('keyup', function (e) {
                // 엔터 키 입력 시 데이터 조회
                if (e.keyCode == 13) {
                    table.search(this.value).draw();
                }
            });
        },
        buttons: [
            {
                name: 'refresh',
                text: '<i class="fa fa-redo"></i> 새로고침',
                action: function () {
                    reloadTable();
                }
            },
            {
                name: 'add',
                text: '<i class="fa fa-plus"></i> 추가',
                action: function () {
                    openModal();
                }
            },
            {
                name: 'del',
                text: '<i class="fa fa-minus"></i> 삭제',
                action: function () {
                    openDeleteModal();
                }
            },
            {
                extend: 'colvis',
                text: '<i class="fa fa-columns"></i> 필드 보기'
            }
        ]
    });

    //데이터 테이블 필터
    table.columns().every(function () {
        let that = this;

        $('#table-foot input').off('keyup change').on('keyup change', function (e) {
            //엔터 버튼을 클릭한 경우
            if (e.keyCode == 13) {
                const col = $(this).parents('th').attr('data-column');
                const val = this.value;

                //값이 변경된 경우
                if (that.column(col).search() !== val) {
                    that.column(col).search(val, false, true).draw();
                }
            }
        });

        $('#table-foot select').off('keyup change').on('keyup change', function () {
            const col = $(this).parents('th').attr('data-column');
            const val = this.value;

            //값이 변경된 경우
            if (that.column(col).search() !== val) {
                that.column(col).search(val, false, true).draw();
            }
        });

    });
}

function openModal() {
    //모달이 열릴 때
    $('#menu-modal').off('show.bs.modal').on('show.bs.modal', function () {
        clearFormData('#menu-modal');   //모든 입력 및 선택 데이터 초기화
    });

    //추가 / 편집 버튼 클릭 시
    $('#btn-ok').off('click').on('click', function () {
        if ($('#user').val() === '0') {
            showModal('경고', '사용자를 선택하십시오.');
        }

        else {
            $('#menu-modal').modal('hide');

            let param = new FormData();
            param.append('user', $('#user').val());

            //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
            setTimeout(function () {
                //추가 수행
                addData(param);
            }, 500);
        }
    });

    //모달이 닫힐 때
    $('#menu-modal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
        clearFormData('#menu-modal');   //모든 입력 및 선택 데이터 초기화
    });

    $('#menu-modal').attr('tabindex', -1);
    $('#menu-modal').modal({
        show: true,
        backdrop: 'static',
        keyboard: true
    });
}

function addData(param) {
    axios(
        {
            method: 'POST',
            url: requestUrl,
            data: param,
        })
        .then(function (response) {

            if (response && response.status == 201) {
                toastr.success('토큰 추가에 성공하였습니다.');
                reloadTable();
                
                setTimeout(function () {
                    location.reload(); // 현 페이지 새로고침 수행
                }, 2000);
            }

            else {
                checkRedirectLoginPage(response, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = '토큰 추가에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }
        })
        .catch(function (error) {
            let msg = '토큰 추가에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
            toastr.error(msg);
        });
}

function openDeleteModal() {
    const token = $('input[name="selected-token"]:checked').val();

    //선택한 항목이 있을 경우
    if (token) {
        showPasswordModal('토큰 삭제를 위해 비밀번호 입력이 필요합니다. 비밀번호를 입력하십시오.',
            function (modalResult) {
                let data = new Object();
                data.user_data = modalResult;
                data.username = $('input[name="selected-token"]:checked').parent().parent().parent()[0].id;
                deleteData(token, data);
            }
        );
    }

    //선택한 항목이 없을 경우
    else {
        showModal('경고', '토큰을 선택해 주십시오.');
    }
}

function deleteData(token, data) {
    axios(
        {
            method: 'delete',
            url: requestUrl + '/' + token,
            data: data
        })
        .then(function (response) {
            if (response && response.status == 204) {
                toastr.success('토큰 삭제에 성공하였습니다.');
                reloadTable();
                
                setTimeout(function () {
                    location.reload(); // 현 페이지 새로고침 수행
                }, 2000);
            }

            else {
                toastr.error('토큰 삭제에 실패하였습니다.');
            }

            //패스워드 입력 모달 닫기
            closePasswordModal();
        })
        .catch(function (error) {
            if (error.response.status === 400) {
                let msg = '토큰 삭제에 실패하였습니다. 필수 파라미터가 존재하지 않습니다.';
                toastr.error(msg);

                //패스워드 입력 모달 닫기
                closePasswordModal();
            }

            else if (error.response.status === 401) {
                let msg = '토큰 삭제에 실패하였습니다. 비밀번호가 일치하지 않습니다.';
                toastr.error(msg);

                //확인 버튼 활성화
                changePWModalBtnStatus(true);
            }

            else if (error.response.status === 409) {
                let msg = '토큰 삭제에 실패하였습니다. 토큰 정보를 찾을 수 없습니다.';
                toastr.error(msg);

                //패스워드 입력 모달 닫기
                closePasswordModal();

                reloadTable();
            }

            else {
                checkRedirectLoginPage(error, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = '토큰 삭제에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
                toastr.error(msg);

                //패스워드 입력 모달 닫기
                closePasswordModal();

                // console.log(error);
            }
        });
}

function reloadTable() {
    //DataTable 조회 수행
    $('#table-data').DataTable().ajax.reload();
}

$(function () {
    initDataTable();

    //마우스 우클릭 - 컨텍스트 메뉴
    $.contextMenu({
        selector: '#table-data tbody tr',
        callback: function (key, options) {
            const table = $('#table-data').DataTable();

            switch (key) {
                case 'refresh':
                    //새로고침 버튼 클릭
                    table.buttons('refresh:name').trigger();
                    break;

                case 'add':
                    //추가 버튼 클릭
                    table.buttons('add:name').trigger();
                    break;

                case 'del':
                    //삭제 버튼 클릭
                    table.buttons('del:name').trigger();
                    break;
            }
        },

        items: {
            refresh: { name: '새로고침' },
            add: { name: '추가' },
            del: { name: '삭제' },
        }
    });

});