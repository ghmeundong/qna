const params = new URLSearchParams(window.location.search);
const userId = params.get("userId") || localStorage.getItem("userId");
const role = params.get("role") || localStorage.getItem("role");
const toast = document.getElementById("toast");
const welcomeText = document.getElementById("welcomeText");
const chatbotBtn = document.getElementById("chatbotBtn");
const messengerBtn = document.getElementById("messengerBtn");
const backBtn = document.getElementById("backBtn");

function showToast(msg, duration = 1800) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

async function postData(url = "", data = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!userId) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }

    const keyRes = await fetch("/vapidPublicKey");
    const keyData = await keyRes.json();
    if (!keyData.success || !keyData.publicKey) return;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
    await postData("/subscribe", { userId, subscription });
  } catch (err) {
    console.error("Push registration failed:", err);
  }
}

if (!userId || !role) {
  window.location.href = "index.html";
} else {
  const message = `${userId}님, 환영합니다. 다른 분들과 대화하시려면 [메신저]를, 저와 대화하시려면 [QnA ai]을 선택해주세요. 단, 게스트 분들은 답변에 제한이 있을 수 있습니다.`;
  let index = 0;
  
  function typeMessage() {
    if (index < message.length) {
      welcomeText.textContent += message.charAt(index);
      index++;
      setTimeout(typeMessage, 15);
    }
  }
  
  typeMessage();
  registerPushNotifications();
}

chatbotBtn.addEventListener("click", () => {
  window.location.href = `main.html?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&mode=chat`;
});

messengerBtn.addEventListener("click", () => {
  window.location.href = `main.html?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&mode=messenger`;
});

backBtn.addEventListener("click", () => {
  localStorage.removeItem("userId");
  localStorage.removeItem("role");
  window.location.href = "index.html";
});

window.addEventListener("error", () => {
  showToast("알 수 없는 오류가 발생했습니다.");
});
