function keyUpEvent(e)
{
    if (e.keyCode === 13)
    {
        confirmChangePassword();
    }
}

function keyDownEvent(e)
{
    if (e.keyCode === 13)
    {
        return false;
    }
}

function confirmChangePassword()
{
    let pw = document.getElementById('old_password').value;
    let newPW = document.getElementById('new_password1').value;
    let newPWConfirm = document.getElementById('new_password2').value;
    let message = '';

    if (pw.length === 0)
    {
        message = '기존 비밀번호를 입력하십시오.';
    }

    else if (newPW.length === 0)
    {
        message = '신규 비밀번호를 입력하십시오.';
    }

    else if (newPW.length < 8 || newPW.length > 120)
    {
        message = '신규 비밀번호는 8자 이상 120자 이하로 입력하십시오.';
    }

    else if (newPWConfirm.length === 0)
    {
        message = '신규 비밀번호 확인을 입력하십시오.';
    }

    else if (newPW !== newPWConfirm)
    {
        message = '신규 비밀번호가 일치하지 않습니다.';
    }

    if (message.length > 0){
        showModal('경고', message);
    }

    else
    {
        message = '비밀번호 변경 시 자동으로 로그아웃됩니다.\r\n비밀번호를 변경하시겠습니까?';
        showConfirmModal('확인', message,
            function (result)
            {
                if (result === true)
                {
                    if (document.getElementById('submit_form') != null)
                    {
                        document.getElementById('submit_form').submit();
                    }
                }
            }
        );
    }
}