const BASE_URL = "";
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const showSignup = document.getElementById("showSignup");
const backLogin = document.getElementById("backLogin");
const toast = document.getElementById("toast");
let toastTimeout = null;

const savedUserId = localStorage.getItem("userId");
const savedRole = localStorage.getItem("role");
if (savedUserId && savedRole) {
  window.location.href = `select.html?userId=${encodeURIComponent(savedUserId)}&role=${encodeURIComponent(savedRole)}`;
}

// 화면 전환
showSignup.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
  signupForm.querySelector("input").focus();
});
backLogin.addEventListener("click", () => {
  signupForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  loginForm.querySelector("input").focus();
});

// 공통 함수: POST 요청
async function postData(url = "", data = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// 공통 함수: Toast 메시지
function showToast(msg, duration = 2000) {
  if (!toast) return;
  clearTimeout(toastTimeout);
  toast.textContent = msg;
  toast.classList.add("show");
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
    toastTimeout = null;
  }, duration);
}

// 공통 함수: 폼 입력값 가져오기
function getInputValues(form) {
  return Array.from(form.querySelectorAll("input")).map((i) => i.value.trim());
}

// 회원가입
signupForm.querySelector(".signup-btn").addEventListener("click", async () => {
  const [userId, password, passwordConfirm, authCode] =
    getInputValues(signupForm);
  if (!userId || !password || !passwordConfirm || !authCode) {
    showToast("모든 항목을 입력해주세요.");
    return;
  }
  if (password !== passwordConfirm) {
    showToast("비밀번호가 일치하지 않습니다.");
    return;
  }
  try {
    const res = await postData(`${BASE_URL}/signup`, {
      userId,
      password,
      authCode,
    });
    showToast(res.msg);
    if (res.success) {
      signupForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
      loginForm.querySelector("input").focus();
    }
  } catch (e) {
    console.error(e);
    showToast("회원가입 중 오류 발생");
  }
});

// 로그인
loginForm.querySelector(".login-btn").addEventListener("click", async () => {
  const [userId, password] = getInputValues(loginForm);
  if (!userId || !password) {
    showToast("아이디와 비밀번호를 입력해주세요.");
    return;
  }
  try {
    const res = await postData(`${BASE_URL}/login`, {
      userId,
      password,
      role: "regular",
    });
    if (!res.success) {
      showToast("로그인 실패: " + res.msg);
      return;
    }
    localStorage.setItem("userId", res.userId);
    localStorage.setItem("role", res.role);
    window.location.href = `select.html?userId=${encodeURIComponent(res.userId)}&role=${encodeURIComponent(res.role)}`;
  } catch (e) {
    console.error(e);
    showToast("로그인 중 오류 발생");
  }
});

// 게스트 로그인
loginForm.querySelector(".guest-btn").addEventListener("click", async () => {
  try {
    const res = await postData(`${BASE_URL}/login`, { role: "guest" });
    if (!res.success) {
      showToast("로그인 실패: " + res.msg);
      return;
    }
    localStorage.setItem("userId", res.userId);
    localStorage.setItem("role", res.role);
    window.location.href = `select.html?userId=${encodeURIComponent(res.userId)}&role=${encodeURIComponent(res.role)}`;
  } catch (e) {
    console.error(e);
    showToast("로그인 중 오류 발생");
  }
});
// 페이지 로드 시 실행되도록 스크립트 작성
document.addEventListener("DOMContentLoaded", () => {
  const knockBtn = document.getElementById("knockBtn");
  const typingDisplay = document.getElementById("typingText");

  // 출력하고 싶은 긴 멘트 정의
  const message =
    "안녕하세요. 기존 회원이시라면 [로그인]을 통해 즉시 신원 조회가 가능합니다. 초대 코드를 소지하신 분은 [회원가입]을, 그 외의 방문객께서는 [게스트로 로그인]을 이용해 주시기 바랍니다.";

  let index = 0;
  let isTyping = false; // 중복 클릭 방지용 변수

  knockBtn.addEventListener("click", () => {
    if (isTyping) return; // 이미 글자가 나오는 중이면 무시

    isTyping = true;
    knockBtn.style.display = "none"; // 버튼을 누르면 노크 버튼은 깔끔하게 숨김
    typingDisplay.textContent = "";   
    function type() {
      if (index < message.length) {
        typingDisplay.textContent += message.charAt(index);
        index++;
        setTimeout(type, 15); // 30ms(0.03초) 간격으로 한 글자씩 출력 (숫자가 작을수록 빨라짐)
      } else {
        isTyping = false;
      }
    }

    type(); // 타이핑 함수 실행
  });
});

[loginForm, signupForm].forEach((form) =>
  form.querySelectorAll("input").forEach((inp) =>
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        form.querySelector("button").click();
      }
    }),
  ),
);
