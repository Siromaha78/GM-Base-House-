console.log("🔥 ЧИСТЫЙ APP.JS 🔥");

let provider;
let signer;
let contract;

const contractAddress = "0x1db3F0bddd987EE3c4b6a7EDEe2863DdE3b7Ee89";

const abi = [
  "function gm() external",
  "function currentStreak(address) view returns (uint256)"
];

// 🔹 Подключение кошелька
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert("Установи MetaMask");
        return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);

    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();

    const address = await signer.getAddress();
    console.log("Кошелёк:", address);

    const network = await provider.getNetwork();
    console.log("Network:", network);

    // 👉 подключаем контракт для чтения
    contract = new ethers.Contract(contractAddress, abi, provider);

    // 👉 сразу получаем streak
    const streak = await contract.currentStreak(address);
renderBricks(streak.toNumber());
   console.log("Текущий streak:", streak.toNumber());

    document.getElementById("status").innerText =
        "Кошелёк: " + address + " | 🔥 Streak: " + streak.toNumber();
}

// 🔹 Отправка GM
async function sendGM() {
   if (!signer) {
    alert("Сначала подключи кошелёк");
    return;
}

const button = document.getElementById("gm-button");
button.disabled = true;
button.innerText = "⏳ Sending...";

    const network = await provider.getNetwork();

  if (network.chainId !== 84532) {
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x14A34" }]
        });
window.location.reload();
return;
    } catch (error) {
        alert("Переключись вручную на Base Sepolia");
        console.log("❌ Не удалось переключить сеть:", error);
        button.disabled = false;
        button.innerText = "🧱 GM (receive a brick)";
        return;
    }
}

    contract = new ethers.Contract(contractAddress, abi, signer);

let tx;

try {
  tx = await contract.gm();

  document.getElementById("status").innerText = "Транзакция отправлена...";

  await tx.wait();

  const address = await signer.getAddress();
  let streak = await contract.currentStreak(address);
  streak = streak.toNumber();

  renderBricks(streak);

  console.log("Новый streak:", streak);

  document.getElementById("status").innerText =
    "Кошелёк: " + address + " | 🔥 Streak: " + streak;

} catch (error) {
  if (error.message && error.message.includes("Already GM today")) {
  document.getElementById("status").innerText =
    "Oops, you have already GM'd today! 🙂";
} else {
  console.error("Ошибка:", error);

  document.getElementById("status").innerText =
    "Transaction failed 😢";
}

  return;

} finally {
  button.disabled = false;
  button.innerText = "🧱 GM (receive a brick)";
}
}

function renderBricks(count) {
  const area = document.getElementById("brick-area");
area.style.display = "flex";
area.style.flexWrap = "wrap";
area.style.gap = "5px";
  area.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const brick = document.createElement("div");

   brick.className = "brick";
    
    area.appendChild(brick);
  }
}

window.connectWallet = connectWallet;
window.sendGM = sendGM;

window.addEventListener("load", async () => {
  if (typeof window.ethereum !== "undefined") {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });

    if (accounts.length > 0) {
      connectWallet();
    }
  }
});

window.ethereum.on("chainChanged", () => {
  window.location.reload();
});