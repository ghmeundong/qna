const BASE_URL = "";
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const sidebar = document.getElementById("sidebar");
const logoutBtn = document.getElementById("logoutBtn");
const switchModeBtn = document.getElementById("switchModeBtn");
const toast = document.getElementById("toast");
const sidebarTitle = document.getElementById("sidebarTitle");
const conversationInfo = document.getElementById("conversationInfo");
const userList = document.getElementById("userList");
const modeBanner = document.getElementById("modeBanner");
const mobileBackBtn = document.getElementById("mobileBackBtn");
const chatContainer = document.getElementById("chatContainer");
const params = new URLSearchParams(window.location.search);
const userId =
  params.get("userId") ||
  localStorage.getItem("userId") ||
  `guest_${Date.now()}`;
const role = params.get("role") || localStorage.getItem("role") || "guest";
const mode = params.get("mode") || "chat";
let selectedPeerId = params.get("peerId");
let participants = [];
let socket = null;
let typingTimeout = null;
let toastTimeout = null;

if (!userId) {
  try {
    localStorage.clear();
  } catch (e) {}
  window.location.href = "index.html";
}

function setViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  const vh = height * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setViewportHeight();

window.addEventListener('resize', setViewportHeight);
window.visualViewport?.addEventListener('resize', setViewportHeight); 


function addMessage(text, className) {
  const msg = document.createElement("div");
  msg.className = "message " + className;
  msg.textContent = text;
  const wasAtBottom = isScrolledToBottom();
  chatArea.appendChild(msg);
  if (wasAtBottom) {
    scrollChatToBottom();
  }
}

function addSystemMessage(text) {
  const msg = document.createElement("div");
  msg.className = "message system";
  msg.textContent = text;
  const wasAtBottom = isScrolledToBottom();
  chatArea.appendChild(msg);
  if (wasAtBottom) {
    scrollChatToBottom();
  }
}

function isMobile() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

function isScrolledToBottom() {
  const threshold = 50;
  return chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight <= threshold;
}

function updateMobileView() {
  const isGuest = role === "guest";
  if (!isMobile()) {
    sidebar.classList.remove("mobile-messenger");
    sidebar.classList.remove("mobile-chat-open");
    mobileBackBtn.classList.remove("show");
    logoutBtn.style.display = "block";
    return;
  }

  if (mode === "messenger") {
    sidebar.classList.add("mobile-messenger");
    if (selectedPeerId) {
      sidebar.classList.add("mobile-chat-open");
      mobileBackBtn.classList.add("show");
      logoutBtn.style.display = "block";
    } else {
      sidebar.classList.remove("mobile-chat-open");
      mobileBackBtn.classList.remove("show");
      logoutBtn.style.display = isGuest ? "block" : "none";
    }
  } else {
    sidebar.classList.remove("mobile-messenger");
    sidebar.classList.remove("mobile-chat-open");
    mobileBackBtn.classList.add("show");
    logoutBtn.style.display = "block";
  }
}

function adjustLayoutForMobileChrome() {
  if (!("visualViewport" in window)) return;

  let scheduled = null;
  const updateChatScroll = () => {
    if (document.activeElement !== userInput) return;
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => {
      chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: "smooth" });
      scheduled = null;
    });
  };

  const delayedUpdate = () => {
    setTimeout(updateChatScroll, 150);
  };

  userInput?.addEventListener("focus", () => {
    updateChatScroll();
    delayedUpdate();
  });

  window.visualViewport?.addEventListener("resize", () => {
    updateChatScroll();
  });
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: "smooth" });
  });
}

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

async function postData(url = "", data = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.status);
  }
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

function showTyping() {
  if (document.getElementById("typingIndicator")) return;
  const t = document.createElement("div");
  t.className = "typing";
  t.id = "typingIndicator";
  t.innerHTML =
    '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  chatArea.appendChild(t);
  requestAnimationFrame(() => {
    chatArea.scrollTo({
      top: chatArea.scrollHeight,
      behavior: "smooth",
    });
  });
}

function hideTyping() {
  const t = document.getElementById("typingIndicator");
  if (t) t.remove();
}

function initializeSocket() {
  if (socket || typeof io === "undefined") return;
  socket = io();

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
    socket.emit("join", { userId });
  });

  socket.on("private_message", (payload) => {
    if (!payload || payload.toUserId !== userId) return;
    const isCurrentPeer = payload.fromUserId === selectedPeerId;
    if (isCurrentPeer) {
      hideTyping();
      addMessage(payload.message, "peer");
    } else {
      showToast(`${payload.fromUserId}님으로부터 새 메시지가 도착했습니다.`);
    }
  });

  socket.on("typing", (payload) => {
    console.log("Typing event received:", payload, "selectedPeerId:", selectedPeerId);
    if (!payload || payload.fromUserId !== selectedPeerId) {
      console.log("Filtering out typing event");
      return;
    }
    console.log("Showing typing indicator");
    showTyping();
  });

  socket.on("stop_typing", (payload) => {
    console.log("Stop typing event received:", payload);
    if (!payload || payload.fromUserId !== selectedPeerId) return;
    hideTyping();
  });

  socket.on("connect_error", () => {
    showToast("실시간 연결에 실패했습니다.");
  });
}

async function recordVisitor() {
  try {
    const visitorData = {
      userId,
      role,
      guestId: role === "guest" ? userId : null,
    };
    await postData("/visitor", visitorData);
  } catch (e) {
    console.error("방문자 기록 실패:", e);
  }
}

recordVisitor();

let isRequesting = false;
let isLoadingHistory = false;
let historySkip = 0;
const historyLimit = 10;
let isTyping = false;

function renderModeInfo() {
  const modeLabel = mode === "messenger" ? "메신저" : "QnA ai";
  const bannerText = document.getElementById("bannerText");
  
  if (mode === "messenger") {
    const guestNotice = "메신저는 로그인 후 이용 가능합니다.";
    const isGuestNotice = role === "guest" && !selectedPeerId;
    if (bannerText) {
      bannerText.textContent = isGuestNotice ? guestNotice : selectedPeerId ? `${selectedPeerId}` : "대화 상대를 선택하세요.";
    }
    conversationInfo.textContent = isGuestNotice
      ? guestNotice
      : selectedPeerId
      ? `대화 상대: ${selectedPeerId}`
      : "대화 상대를 선택하세요.";
    userInput.placeholder = isGuestNotice
      ? guestNotice
      : selectedPeerId
      ? `${selectedPeerId}님에게 보낼 메시지를 입력하세요.`
      : "대화 상대를 선택하세요.";
    userInput.disabled = role === "guest" || !selectedPeerId;
    sendBtn.disabled = role === "guest" || !selectedPeerId;
    switchModeBtn.textContent = "챗봇으로 이동";
  } else {
    if (bannerText) {
      bannerText.textContent = "비서실장";
    }
    conversationInfo.textContent = "AI 챗봇과 대화합니다.";
    userInput.placeholder = "질문을 입력해주세요";
    userInput.disabled = false;
    sendBtn.disabled = false;
    switchModeBtn.textContent = "메신저로 이동";
  }
  sidebarTitle.textContent = modeLabel;
  if (role === "guest") {
    logoutBtn.textContent = "로그인";
  } else {
    logoutBtn.textContent = "로그아웃";
  }
}

function renderParticipants(list) {
  userList.innerHTML = "";
  
  if (role === "guest") {
    return;
  }
  
  if (!list.length) {
    userList.innerHTML =
      "<div class='sidebar-empty'>등록된 사용자 정보가 없습니다.</div>";
    return;
  }
  list.forEach((participant) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "participant-item";
    if (participant === selectedPeerId) {
      item.classList.add("active");
    }
    item.textContent = participant;
    item.addEventListener("click", () => selectPeer(participant));
    userList.appendChild(item);
  });
}

function updateUrlPeer(peerId) {
  const searchParams = new URLSearchParams(window.location.search);
  if (peerId) {
    searchParams.set("peerId", peerId);
  } else {
    searchParams.delete("peerId");
  }
  window.history.replaceState({}, "", `${window.location.pathname}?${searchParams.toString()}`);
}

function selectPeer(peerId) {
  if (selectedPeerId === peerId) return;
  selectedPeerId = peerId;
  historySkip = 0;
  chatArea.innerHTML = "";
  renderModeInfo();
  renderParticipants(participants);
  updateUrlPeer(peerId);
  updateMobileView();
  loadMessengerHistory(true);
}

mobileBackBtn?.addEventListener("click", () => {
  if (!isMobile()) return;
  if (mode === "messenger") {
    selectedPeerId = null;
    historySkip = 0;
    chatArea.innerHTML = "";
    renderModeInfo();
    renderParticipants(participants);
    updateUrlPeer("");
    updateMobileView();
  } else {
    window.location.href = `select.html?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}`;
  }
});

async function loadParticipants() {
  try {
    const res = await fetch(`/participants?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (data.success) {
      participants = data.participants;
      renderParticipants(participants);
      if (!selectedPeerId && participants.length > 0) {
        addSystemMessage("목록에서 대화 상대를 선택하세요.");
      }
    }
  } catch (e) {
    console.error("참여자 목록 로드 실패:", e);
  }
}

function appendMessengerMessages(messages, reset = false) {
  if (reset) {
    chatArea.innerHTML = "";
  }
  messages.forEach((chat) => {
    addMessage(chat.message, chat.senderId === userId ? "user" : "peer");
  });
}

function prependMessengerMessages(messages) {
  const previousScrollHeight = chatArea.scrollHeight;
  const previousScrollTop = chatArea.scrollTop;
  messages.slice().reverse().forEach((chat) => {
    const msg = document.createElement("div");
    msg.className = "message " + (chat.senderId === userId ? "user" : "peer");
    msg.textContent = chat.message;
    chatArea.insertBefore(msg, chatArea.firstChild);
  });
  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight - previousScrollHeight + previousScrollTop;
  });
}

async function loadMessengerHistory(reset = false) {
  if (!selectedPeerId || isLoadingHistory) return;
  if (reset) {
    historySkip = 0;
    chatArea.innerHTML = "";
  }
  isLoadingHistory = true;
  try {
    const res = await fetch(
      `/messages?userId=${encodeURIComponent(userId)}&peerId=${encodeURIComponent(selectedPeerId)}&skip=${historySkip}&limit=${historyLimit}`
    );
    const data = await res.json();
    if (data.success && data.messages.length > 0) {
      const messages = data.messages.reverse();
      if (historySkip === 0) {
        appendMessengerMessages(messages, true);
      } else {
        prependMessengerMessages(messages);
      }
      historySkip += historyLimit;
      
      // 초기 로드 시 화면이 스크롤 가능할 때까지 반복 로드
      if (reset && chatArea.scrollHeight <= chatArea.clientHeight && data.messages.length === historyLimit) {
        isLoadingHistory = false;
        await loadMessengerHistory(false);
        return;
      }
    } else if (reset) {
      addSystemMessage("대화 기록이 없습니다. 새로운 대화를 시작해보세요.");
    }
  } catch (e) {
    console.error("메시지 기록 로드 실패:", e);
  } finally {
    isLoadingHistory = false;
  }
}

async function loadHistory() {
  if (mode === "chat") {
    if (isLoadingHistory || userId.startsWith("guest_")) return;
    isLoadingHistory = true;
    try {
      const res = await fetch(
        `/history?userId=${encodeURIComponent(userId)}&skip=${historySkip}&limit=${historyLimit}`
      );
      const data = await res.json();
      if (data.success && data.chats.length > 0) {
        const chats = data.chats.reverse();
        const isInitialLoad = historySkip === 0;
        if (isInitialLoad) {
          chats.forEach((chat) => {
            addMessage(chat.question, "user");
            addMessage(chat.answer, "ai");
          });
          requestAnimationFrame(scrollChatToBottom);
        } else {
          const previousScrollHeight = chatArea.scrollHeight;
          const previousScrollTop = chatArea.scrollTop;
          chats.slice().reverse().forEach((chat) => {
            const answerMsg = document.createElement("div");
            answerMsg.className = "message ai";
            answerMsg.textContent = chat.answer;
            chatArea.insertBefore(answerMsg, chatArea.firstChild);
            const questionMsg = document.createElement("div");
            questionMsg.className = "message user";
            questionMsg.textContent = chat.question;
            chatArea.insertBefore(questionMsg, chatArea.firstChild);
          });
          requestAnimationFrame(() => {
            chatArea.scrollTop = chatArea.scrollHeight - previousScrollHeight + previousScrollTop;
          });
        }
        historySkip += historyLimit;
        
        // 초기 로드 시 화면이 스크롤 가능할 때까지 반복 로드
        if (isInitialLoad && chatArea.scrollHeight <= chatArea.clientHeight && data.chats.length === historyLimit) {
          isLoadingHistory = false;
          await loadHistory();
          return;
        }
      }
    } catch (e) {
      console.error("대화 내역 로드 실패:", e);
    } finally {
      isLoadingHistory = false;
    }
  }
}

async function sendMessage() {
  if (isRequesting) return;
  const text = userInput.value.trim();
  if (!text) return;
  if (mode === "messenger" && !selectedPeerId) {
    showToast("메시지를 보내기 전에 대화 상대를 선택하세요.");
    return;
  }

  userInput.value = "";
  if (mode === "chat") {
    addMessage(text, "user");
    scrollChatToBottom();
    showTyping();
    sendBtn.disabled = true;
    isRequesting = true;
    try {
      const data = await postData(`${BASE_URL}/chat`, { userId, role, question: text });
      addMessage(data.answer || "AI가 답변하지 못했습니다.", "ai");
      scrollChatToBottom();
    } catch (e) {
      console.error(e);
      addMessage("AI 응답 실패", "ai");
      showToast(e.message || "오류발생", 2500);
    } finally {
      hideTyping();
      sendBtn.disabled = false;
      userInput.focus();
      isRequesting = false;
    }
  } else {
    addMessage(text, "user");
    scrollChatToBottom();
    sendBtn.disabled = true;
    isRequesting = true;
    try {
      if (socket && socket.connected) {
        socket.emit("private_message", {
          fromUserId: userId,
          toUserId: selectedPeerId,
          message: text,
        });
      } else {
        await postData(`${BASE_URL}/message`, {
          fromUserId: userId,
          toUserId: selectedPeerId,
          message: text,
        });
      }
    } catch (e) {
      console.error(e);
      showToast("메시지 전송 실패", 2500);
    } finally {
      sendBtn.disabled = false;
      userInput.focus();
      isRequesting = false;
    }
  }
}

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (isRequesting) {
      showToast("이전 요청이 처리 중입니다. 잠시만 기다려 주세요.", 1500);
      return;
    }
    sendMessage();
  }
});
sendBtn.addEventListener("click", sendMessage);
logoutBtn?.addEventListener("click", () => {
  try {
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
  } catch (e) {}
  window.location.href = "index.html";
});
switchModeBtn?.addEventListener("click", () => {
  if (mode === "messenger") {
    window.location.href = `main.html?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&mode=chat`;
  } else {
    window.location.href = `main.html?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&mode=messenger`;
  }
});

userInput.addEventListener("focus", () => {
  scrollChatToBottom();
});

document.addEventListener("DOMContentLoaded", () => {
  sidebar.classList.add("expanded");
  renderModeInfo();
  updateMobileView();
  if (mode === "messenger") {
    if (role === "guest") {
      renderParticipants([]);
    } else {
      initializeSocket();
      loadParticipants();
      if (selectedPeerId) {
        loadMessengerHistory(true);
      }
    }
  } else {
    loadHistory();
  }

  adjustLayoutForMobileChrome();
  registerPushNotifications();
});

userInput.addEventListener("input", () => {
  sidebar.classList.remove("expanded");
  
  // 메신저 모드에서만 typing 이벤트 전송
  if (mode === "messenger" && selectedPeerId && socket && socket.connected) {
    console.log("Sending typing event - userId:", userId, "selectedPeerId:", selectedPeerId, "connected:", socket.connected);
    if (!isTyping) {
      isTyping = true;
      socket.emit("typing", { fromUserId: userId, toUserId: selectedPeerId });
      console.log("Typing event emitted");
    }
    
    // 기존 타이머 클리어
    clearTimeout(typingTimeout);
    
    // 2초 후 stop_typing 전송
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit("stop_typing", { fromUserId: userId, toUserId: selectedPeerId });
      console.log("Stop typing event emitted");
    }, 2000);
  } else {
    console.log("Typing condition not met - mode:", mode, "selectedPeerId:", selectedPeerId, "socket:", !!socket, "connected:", socket?.connected);
  }
});

userInput.addEventListener("blur", () => {
  // 포커스 아웃 시 즉시 stop_typing 전송
  if (mode === "messenger" && selectedPeerId && socket && socket.connected && isTyping) {
    isTyping = false;
    clearTimeout(typingTimeout);
    socket.emit("stop_typing", { fromUserId: userId, toUserId: selectedPeerId });
  }
});

chatArea.addEventListener("scroll", () => {
  if (chatArea.scrollTop < 50 && !isLoadingHistory) {
    if (mode === "chat") {
      loadHistory();
    } else {
      loadMessengerHistory();
    }
  }
});

window.addEventListener("resize", () => {
  updateMobileView();
});

