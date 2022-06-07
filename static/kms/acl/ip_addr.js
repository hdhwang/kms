'use strict';

const requestUrl = '/acl/ip-addr/api';   //API URL
const ipPattern = /\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;

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
                data: 'id',
                defaultContent: '',
                render: function (data, type) {
                    data = escapeHtml(data);
                    if (type === 'display') {
                        const id = 'checkbox-' + data;
                        return '<div class="icheck-primary"><input type="checkbox" name="selected" id="' + id +
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
            {
                className: 'dt-center link',
                data: 'ip',
                defaultContent: '',
                render: function (data, type, row) {
                    data = escapeHtml(data);
                    let ip = data;
                    if (row.cidr != 32) {
                        ip += '/' + row.cidr
                    }

                    return ip;
                }
            },
            { className: 'dt-center link', data: 'comment', defaultContent: '', render: $.fn.dataTable.render.text() },
        ],
        rowId: 'id',
        dom: getDataTablesDom(),
        lengthMenu: [[10, 20, 50], [10, 20, 50]],                //페이지 당 갯수
        order: [[2, 'asc']],                                   //조회 시 아이디 기준 기본 정렬
        drawCallback: function (settings, json)                   //조회 완료 후 처리
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
                const val = escapeHtml(this.value);

                //값이 변경된 경우
                if (that.column(col).search() !== val) {
                    if (val != '' && col == 2 && ipPattern.test(val) == false) {
                        showModal('경고', val + '은 올바른 IP 형식이 아닙니다. <br/>올바른 IP 주소를 입력하십시오.');
                        this.value = '';
                    }
                    else {
                        that.column(col).search(val, false, true).draw();
                    }
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

        //클릭 시 편집 수행
        $('#table-data tbody').off('click', 'td').on('click', 'td', function () {
            //link 클래스가 존재하는 경우에만 편집 모달 출력(체크박스 클릭 시 이벤트가 발생하지 않기 위함)
            if ($(this).hasClass('link')) {
                const data = $('#table-data').DataTable().row($(this).parent()).data();
                openModal(data);
            }
        });

    });
}

function openModal(data = null) {
    //모달이 열릴 때
    $('#menu-modal').off('show.bs.modal').on('show.bs.modal', function () {
        clearFormData('#menu-modal');
        $('#cidr').val('32');

        //편집인 경우
        if (data) {
            $('#modal-title').text('IP 주소 편집');         //타이틀 지정
            setOrgData(data);                            //데이터 세팅
            $('#btn-ok').text('편집');                   //편집 버튼 명 지정
        }

        //추가인 경우
        else {
            $('#modal-title').text('IP 주소 추가');  //타이틀 지정
            $('#btn-ok').text('추가');  //추가 버튼 명 지정
        }
    });

    //초기화 버튼 클릭 시
    $('#btn-reset').off('click').on('click', function () {
        //정책 편집인 경우 기존 정보로 초기화
        if (data) {
            setOrgData(data);
        }

        //정책 추가인 경우 모든 항목 공백으로 초기화
        else {
            clearFormData('#menu-modal');
            $('#cidr').val('32');
        }
    });

    //추가 / 편집 버튼 클릭 시
    $('#btn-ok').off('click').on('click', function () {
        if ($.trim($('#ip').val()) === '') {
            showModal('경고', 'IP 주소를 입력하십시오.');
        }

        else if (ipPattern.test($('#ip').val()) == false) {
            showModal('경고', '올바른 IP 주소를 입력하십시오.');
        }

        else if ($.trim($('textarea#comment').val()) === '') {
            showModal('경고', '설명을 입력하십시오.');
        }

        else {
            $('#menu-modal').modal('hide');

            let param = new FormData();
            param.append('ip', $('#ip').val());
            param.append('cidr', $('#cidr').val());
            param.append('comment', $('textarea#comment').val());

            //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
            setTimeout(function () {
                if (data) {
                    //변경된 사항이 존재하는 경우에만 편집 수행
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

    //모달이 닫힐 때
    $('#menu-modal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
        clearFormData('#menu-modal');   //모든 입력 및 선택 데이터 초기화
        $('#cidr').val('32');
    });

    $('#menu-modal').attr('tabindex', -1);
    $('#menu-modal').modal({
        show: true,
        backdrop: 'static',
        keyboard: true
    });
}

function setOrgData(data) {
    $('#ip').val(data.ip);                    //IP
    $('#cidr').val(data.cidr);                //CIDR
    $('textarea#comment').val(data.comment);  //설명
}

function compareData(data, param) {
    if (param.get('ip') != data.ip ||
        param.get('cidr') != data.cidr ||
        param.get('comment') != data.comment) {
        return false;
    }

    return true;
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
                toastr.success('IP 주소 추가에 성공하였습니다.');
                reloadTable();
            }

            else {
                checkRedirectLoginPage(response, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = 'IP 주소 추가에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }
        })
        .catch(function (error) {
            let msg = 'IP 주소 추가에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
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
                toastr.success('IP 주소 편집에 성공하였습니다.');
                reloadTable();
            }

            else {
                let msg = 'IP 주소 편집에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }
        })
        .catch(function (error) {
            checkRedirectLoginPage(error, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

            let msg = 'IP 주소 편집에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
            toastr.error(msg);
        });
}

function openDeleteModal() {
    let idList = new Array();

    //선택한 항목들의 id를 idList에 추가
    $('input[name="selected"]:checked').each(function () {
        const id = $(this).val();
        idList.push(id);
    });

    //선택한 항목이 있을 경우
    if (idList.length > 0) {
        showConfirmModal('확인', '선택한 IP 주소를 삭제하시겠습니까?',
            function (confirm) {
                //확인 버튼을 클릭한 경우
                if (confirm === true) {
                    //axios를 동기식으로 동작
                    deleteData(idList).then(function (result) {
                        idList = [];    //모두 완료한 후 idList 초기화

                        setTimeout(function () {
                            if (result == true) {
                                toastr.success('IP 주소 삭제에 성공하였습니다.');
                                reloadTable();
                            }

                            else {
                                checkRedirectLoginPage(result, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인
                                toastr.error('IP 주소 삭제에 실패하였습니다.');
                            }
                        }, 500);
                    });
                }
            }
        );
    }

    //선택한 항목이 없을 경우
    else {
        showModal('경고', 'IP 주소를 선택해 주십시오.');
    }
}

function deleteData(idList) {
    //axios를 동기식으로 동작하도록 함
    return new Promise(function (resolve, reject) {
        try {
            let count = 0;
            let successCount = 0;

            for (let i = 0; i < idList.length; i++) {
                axios(
                    {
                        method: 'delete',
                        url: requestUrl + '/' + idList[i],
                    })
                    .then(function (response) {
                        count++;    //응답 횟수 증가
                        if (response && response.status == 204) {
                            successCount++; //성공 횟수 증가
                        }

                        //응답 횟수가 요청 횟수와 같은 경우
                        if (count === idList.length) {
                            //성공 횟수와 응답 횟수가 동일한 경우 true 리턴
                            if (count === successCount) {
                                resolve(true);
                            }

                            //성공 횟수와 응답 횟수가 동일하지 않은 경우 false 리턴
                            else {
                                resolve(false);
                            }
                        }
                    })
                    .catch(function (error) {
                        resolve(error);
                        // console.log(error);
                    });
            }
        }
        catch (error) {
            reject(error);
        }
    });
}

function reloadTable() {
    //DataTable 조회 수행
    $('#table-data').DataTable().ajax.reload();
}

$(function () {
    initDataTable();
    $('#ip').inputmask();

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

                case 'del':
                    //삭제 버튼 클릭
                    table.buttons('del:name').trigger();
                    break;
            }
        },

        items: {
            refresh: { name: '새로고침' },
            add: { name: '추가' },
            edit: { name: '편집' },
            del: { name: '삭제' },
        }
    });
});
