'use strict';

const requestUrl = '/account/users/api';   //API URL
const requestCheckUserIDUrl = '/account/users/check'; //사용자 아이디 중복 확인 URL
let userID = '';                              //현재 접속 중인 계정 정보

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
                data: null,
                defaultContent: '',
                render: function (data, type, row, meta) {
                    return meta.settings._iDisplayStart + meta.row + 1;
                },
                orderable: false
            },
            { className: 'dt-center link', data: 'username', defaultContent: '', render: $.fn.dataTable.render.text() },
            {
                className: 'dt-center link',
                data: 'is_superuser',
                defaultContent: '',
                render: function (data, type, row) {
                    data = escapeHtml(data);
                    let html = (data == 1) ? '<span class="badge bg-danger">관리자</span>' : '<span class="badge bg-primary">사용자</span>';
                    return html;
                }
            },
            { className: 'dt-center link', data: 'first_name', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center link', data: 'email', defaultContent: '', render: $.fn.dataTable.render.text() },
            {
                className: 'dt-center link',
                data: 'is_active',
                defaultContent: '',
                render: function (data, type, row) {
                    data = escapeHtml(data);
                    let html = (data == 1) ? '<span class="badge bg-primary">활성</span>' : '<span class="badge bg-danger">비활성</span>';
                    return html;
                }
            },
            { className: 'dt-center link', data: '_date_joined', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center link', data: '_last_login', defaultContent: '', render: $.fn.dataTable.render.text() },
        ],
        rowId: 'id',
        dom: getDataTablesDom(),
        lengthMenu: [[10, 20, 50], [10, 20, 50]],                 //페이지 당 갯수
        pageLength: 20,                                           //페이지 당 갯수 기본 값
        order: [[1, 'asc']],                                    //조회 시 사용자 아이디 기준 기본 정렬
        drawCallback: function (settings, json)                    //조회 완료 후 처리
        {
            //현재 접속 중인 계정 정보 저장 (비밀번호, 유형 변경 불가능하도록 하기 위함)
            if (settings && settings.json && settings.json.user_id) {
                userID = settings.json.user_id;
            }
        },
        buttons: [
            {
                name: 'refresh',
                text: '<i class="fa fa-redo"></i> 새로고침',
                action: function () {
                    //새로고침 수행 시 데이터 조회
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
                extend: 'colvis',
                text: '<i class="fa fa-columns"></i> 필드 보기'
            }
        ]
    });

    //클릭 시 편집 수행
    $('#table-data tbody').on('click', 'td', function () {
        //link 클래스가 존재하는 경우에만 편집 모달 출력
        if ($(this).hasClass('link')) {
            const data = $('#table-data').DataTable().row($(this).parent()).data();
            openModal(data);
        }
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

function reloadTable() {
    //DataTable 조회 수행
    $('#table-data').DataTable().ajax.reload();
}

//사용자 추가 시 중복 확인 관련 변수
let checkedUserID = false;
let checkedUserIDText = '';

//중복 확인 관련 모든 변수 초기화
function clearUserIDCheckStatus() {
    checkedUserID = false;
    checkedUserIDText = '';
}

//중복 확인 관련 변수에 값 설정
function setCheckFieldStatus(status) {
    checkedUserID = status;
    checkedUserIDText = $('#user-id').val();
}

function openModal(data = null) {
    //모달이 열릴 때
    $('#menu-modal').off('show.bs.modal').on('show.bs.modal', function () {
        clearFormData('#menu-modal');
        $('#user-pw').attr('disabled', false); // 비밀번호
        $('#user-pw-confirm').attr('disabled', false); // 비밀번호 확인
        $('#user-type').attr('disabled', false); // 유형
        $('#active').iCheck('enable'); // 활성화

        //편집인 경우
        if (data) {
            $('#modal-title').text('사용자 편집');            //타이틀 지정
            setOrgData(data);                                   //데이터 세팅
            $('#btn-ok').text('편집');                          //편집 버튼 명 지정

            setFormControlDisabled(true);

            //현재 접속 중인 계정인 경우 비밀번호, 유형, 활성화 항목 비활성화
            if (userID == data.id) {
                $('#user-pw').attr('disabled', true); // 비밀번호
                $('#user-pw-confirm').attr('disabled', true); // 비밀번호 확인
                $('#user-type').attr('disabled', true); // 유형
                $('#active').iCheck('disable'); // 활성화
            }
        }

        //추가인 경우
        else {
            $('#modal-title').text('사용자 추가');        //타이틀 지정
            $('#btn-ok').text('추가');                       //추가 버튼 명 지정
            $('#active').iCheck('check');
            setFormControlDisabled(false);
        }
    });

    //초기화 버튼 클릭 시
    $('#btn-reset').off('click').on('click', function () {
        //편집인 경우 기존 정보로 초기화
        if (data) {
            setOrgData(data);
        }

        //추가인 경우 모든 항목 공백으로 초기화
        else {
            clearFormData('#menu-modal');
            $('#active').iCheck('check');
        }
    });

    //추가 / 편집 버튼 클릭 시
    $('#btn-ok').off('click').on('click', function () {
        if ($.trim($('#user-id').val()) === '') {
            showModal('경고', '사용자 아이디를 입력하십시오.');
        }

        else if (checkedUserID == false || (checkedUserIDText != $('#user-id').val())) {
            showModal('경고', '사용자 아이디 중복 확인이 필요합니다.');
        }

        else if (data == null && $.trim($('#user-pw').val()) === '') {
            showModal('경고', '비밀번호를 입력하십시오.');
        }

        else if ($('#user-pw').val().length > 0 && $('#user-pw').val().length < 8) {
            showModal('경고', '비밀번호는 8자 이상 120자 이하로 입력하십시오.');
        }

        else if ($.trim($('#user-pw').val()) !== '' && $.trim($('#user-pw-confirm').val()) === '') {
            showModal('경고', '비밀번호 확인을 입력하십시오.');
        }

        else if ($('#user-pw').val() !== $('#user-pw-confirm').val()) {
            showModal('경고', '비밀번호가 일치하지 않습니다.');
        }

        else if ($('#user-type').val() === '') {
            showModal('경고', '유형을 선택하십시오.');
        }

        else if ($.trim($('#user-name').val()) === '') {
            showModal('경고', '이름을 입력하십시오.');
        }

        else if ($.trim($('#email').val()) === '') {
            showModal('경고', '이메일을 입력하십시오.');
        }

        else if (checkEmailValidation($('#email').val()) == false) {
            showModal('경고', '올바른 이메일 형식으로 입력하십시오.');
        }

        else {
            $('#menu-modal').modal('hide');

            let param = new FormData();
            const active = $('input:checkbox[id="active"]').is(':checked') ? "1" : "0";
            param.append('username', $('#user-id').val());
            param.append('is_superuser', $('#user-type').val());
            param.append('first_name', $('#user-name').val());
            param.append('email', $('#email').val());
            param.append('is_active', active);
            param.append('password', $('#user-pw').val());

            //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
            setTimeout(function () {
                if (data) {
                    //비밀번호가 입력되었거나 변경된 사항이 존재하는 경우에만 편집 수행
                    if (compareData(data, param) == false) {
                        editData(data.id, param);
                    }
                }
                else {
                    //추가 수행
                    addData(param);
                }
            }, 500);

        }
    });

    //중복 확인 버튼에 클릭 이벤트 추가
    $('#user-id-check-btn').off('click').on('click', function () {
        checkUserID();
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

//탐지 필드 확인
function checkUserID() {
    clearUserIDCheckStatus();

    //사용자 아이디가 입력되지 않은 경우
    if ($.trim($('#user-id').val()) === '') {
        showModal('경고', '사용자 아이디를 입력하십시오.');
    }

    //중복 확인 수행
    else {
        let userID = $('#user-id').val();

        axios.get(requestCheckUserIDUrl + '/' + userID).then(function (response) {
            if (response.data && response.data.data) {
                showModal('경고', '사용할 수 없는 사용자 아이디 입니다.');
            }
            else {
                showModal('알림', '사용 가능한 사용자 아이디 입니다.');
                setCheckFieldStatus(true);   //중복 확인 관련 변수에 값 설정
            }

        }).catch(function (error) {
            console.log(error);
        });
    }
}

function setOrgData(data) {
    $('#user-id').val(data.username);                     //아이디
    $('#user-type').val((data.is_superuser) ? 1 : 0);     //유형
    $('#user-name').val(data.first_name);                 //이름
    $('#email').val(data.email);                          //이메일
    $('#active').iCheck((data.is_active) ? 'check' : 'uncheck');  //활성화

    //중복 확인 항목 설정(추가 시 확인한 항목이므로)
    setCheckFieldStatus(true);
}

function compareData(data, param) {
    if (param.get('username') != data.username ||
        param.get('password') != '' ||
        param.get('is_superuser') != data.is_superuser ||
        param.get('first_name') != data.first_name ||
        param.get('email') != data.email ||
        param.get('is_active') != data.is_active) {

        return false;
    }

    return true;
}

function setFormControlDisabled(state) {
    $('#user-id').attr('disabled', state); // 사용자 아이디
    $('#user-id-check-btn').attr('disabled', state); // 중복 확인
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
                toastr.success('사용자 추가에 성공하였습니다.');
                reloadTable();
            }

            //비밀번호 유효성 검증 오류 발생 시
            else if (response && response.data && response.data.error) {
                let msg = '사용자 추가에 실패하였습니다. ' + response.data.error;
                toastr.error(msg);
            }

            else {
                checkRedirectLoginPage(response, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = '사용자 추가에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }
        })
        .catch(function (error) {
            let msg = '사용자 추가에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
            toastr.error(msg);
        });
}

function editData(id, param) {
    axios(
        {
            method: 'PUT',
            url: requestUrl + '/' + id,
            data: param,

        })
        .then(function (response) {
            if (response && response.status == 204) {
                toastr.success('사용자 편집에 성공하였습니다.');
                reloadTable();
            }

            //비밀번호 유효성 검증 오류 발생 시
            else if (response && response.data && response.data.error) {
                let msg = '사용자 편집에 실패하였습니다. ' + response.data.error;
                toastr.error(msg);
            }

            else {
                let msg = '사용자 편집에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }
        })
        .catch(function (error) {
            checkRedirectLoginPage(error, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

            let msg = '사용자 편집에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
            toastr.error(msg);
        });
}

$(function () {
    initDataTable();

    //마우스 우클릭 - 컨텍스트 메뉴
    $.contextMenu({
        selector: '#table-data tbody tr',
        callback: function (key, options) {
            const data = $('#table-data').DataTable().row($(this)).data();
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

                case 'edit':
                    //편집 모달 출력
                    openModal(data);
                    break;
            }
        },

        items: {
            refresh: { name: '새로고침' },
            add: { name: '추가' },
            edit: { name: '편집' },
        }
    });

});