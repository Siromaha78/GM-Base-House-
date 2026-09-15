import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { ethers } from 'ethers'
import './App.css'
import phase1 from './assets/phase1.png'
import phase2 from './assets/phase2.png'
import phase3 from './assets/phase3.png'
import phase4 from './assets/phase4.png'
import phase5 from './assets/phase5.png'
const GM_CONTRACT_ADDRESS = '0xe9017BD869E466Cb015894b09ac3B9d34ebF3313'

const ANNA_TOKEN_ADDRESS = '0x8370EE2576a8825bF3784a2224C3855bFFfa0b07'

const GM_ABI = [
  'function currentStreak(address user) view returns (uint256)',
  'function freezesAvailable(address user) view returns (uint256)',
  'function getCycleDay(address user) view returns (uint256)',
  'function getPhase(address user) view returns (uint256)',
  'function lastGMDay(address user) view returns (uint256)',
  'function canClaimFaucet(address user) view returns (bool)',
  'function nextFaucetTime(address user) view returns (uint256)',
  'function annaBalanceOf(address user) view returns (uint256)',
  'function faucet() external',
  'function gm() external',
]

const ANNA_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
]

function App() {
  const [status, setStatus] = useState('Ready to build on Base')
  const [address, setAddress] = useState('')
  const [environment, setEnvironment] = useState('Checking environment...')
  const [networkName, setNetworkName] = useState('')
  const [streak, setStreak] = useState(null)
  const [freezes, setFreezes] = useState(null)
  const [cycleDay, setCycleDay] = useState(null)
  const [phase, setPhase] = useState(null)
  const [lastGMDay, setLastGMDay] = useState(null)
  const [annaBalance, setAnnaBalance] = useState(null)
  const [canClaimFaucet, setCanClaimFaucet] = useState(null)
  const [nextFaucetTime, setNextFaucetTime] = useState(null)
  const [gmStatus, setGmStatus] = useState('')
  const [lastGMText, setLastGMText] = useState('')
  const [chainTimeOffset, setChainTimeOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const houseImage =
    phase === '1'
      ? phase1
      : phase === '2'
        ? phase2
        : phase === '3'
          ? phase3
          : phase === '4'
            ? phase4
            : phase5

const alleyMode = phase === '5'

  useEffect(() => {
    async function initMiniApp() {
      try {
        await sdk.actions.ready()
        setEnvironment('Farcaster Mini App mode')
      } catch (error) {
        console.log('Not inside Farcaster Mini App:', error)
        setEnvironment('Browser test mode')
      }
    }

    initMiniApp()
  }, [])
 useEffect(() => {
  if (lastGMDay === null) return

  const updateGMStatus = () => {
    if (Number(lastGMDay) === 0) {
      setGmStatus('GM available now')
      return
    }

    const newCurrentGlobalDay = Math.floor(
      (Date.now() / 1000 + chainTimeOffset) / 60
    )

    const daysSinceLastGM =
      newCurrentGlobalDay - Number(lastGMDay)

    if (daysSinceLastGM === 0) {
      setLastGMText('today')
      setGmStatus("Already GM'd today")
    } else if (daysSinceLastGM === 1) {
      setLastGMText('yesterday')
      setGmStatus('GM available now')
    } else if (Number(freezes) > 0) {
      setLastGMText(`${daysSinceLastGM} days ago`)
      setGmStatus('Missed day – freeze can save your streak')
    } else {
      setLastGMText(`${daysSinceLastGM} days ago`)
      setGmStatus('Missed day – next GM will reset streak')
    }
  }

  updateGMStatus()

  const timer = setInterval(updateGMStatus, 5000)

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      updateGMStatus()
    }
  }

  window.addEventListener('focus', updateGMStatus)
  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange
  )

  return () => {
    clearInterval(timer)
    window.removeEventListener('focus', updateGMStatus)
    document.removeEventListener(
      'visibilitychange',
      handleVisibilityChange
    )
  }
}, [lastGMDay, freezes, chainTimeOffset])

useEffect(() => {
  if (nextFaucetTime === null) return

  const updateFaucetStatus = () => {
    if (nextFaucetTime === 0) {
      setCanClaimFaucet(true)
      return
    }

    const chainNow = Math.floor(
      Date.now() / 1000 + chainTimeOffset
    )

    setCanClaimFaucet(chainNow >= nextFaucetTime)
  }

  updateFaucetStatus()

  const timer = setInterval(updateFaucetStatus, 1000)

  return () => clearInterval(timer)
}, [nextFaucetTime, chainTimeOffset])

  async function getEthereumProvider() {
  // Обычный браузер / MetaMask / injected wallet
  if (window.ethereum) {
    setEnvironment('Browser / injected wallet')
    return window.ethereum
  }

  // Настоящий Farcaster Mini App host
  try {
    const farcasterProvider = await Promise.race([
      sdk.wallet.getEthereumProvider(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Farcaster wallet timeout')),
          1500
        )
      ),
    ])

    if (farcasterProvider) {
      setEnvironment('Farcaster Mini App wallet')
      return farcasterProvider
    }
  } catch (error) {
    console.log('Farcaster wallet not available:', error)
  }

  throw new Error('No Ethereum wallet found')
}
  async function switchToBaseMainnet(ethProvider) {
  const baseMainnetChainId = '0x2105'

  try {
    await ethProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: baseMainnetChainId }],
    })
  } catch (switchError) {
    if (switchError.code === 4902) {
      await ethProvider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: baseMainnetChainId,
            chainName: 'Base',
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          },
        ],
      })
    } else {
      throw switchError
    }
  }
}

async function refreshUserData(provider, userAddress, blockTag = undefined) {
    const gmContract = new ethers.Contract(
      GM_CONTRACT_ADDRESS,
      GM_ABI,
      provider
    )

    const currentStreak = await gmContract.currentStreak(
  userAddress,
  { blockTag }
)
console.log('currentStreak OK')

const availableFreezes = await gmContract.freezesAvailable(
  userAddress,
  { blockTag }
)
console.log('freezesAvailable OK')

const currentCycleDay = await gmContract.getCycleDay(
  userAddress,
  { blockTag }
)
console.log('getCycleDay OK')

const currentPhase = await gmContract.getPhase(
  userAddress,
  { blockTag }
)
console.log('getPhase =', currentPhase.toString())

const userLastGMDay = await gmContract.lastGMDay(
  userAddress,
  { blockTag }
)
console.log('lastGMDay OK')

const annaToken = new ethers.Contract(
  ANNA_TOKEN_ADDRESS,
  ANNA_ABI,
  provider
)

let userAnnaBalance = null

try {
  userAnnaBalance = await annaToken.balanceOf(
    userAddress,
    { blockTag }
  )
  console.log('annaToken.balanceOf OK')
} catch (error) {
  console.warn('annaToken.balanceOf failed, continuing refresh:', error)
}

let faucetAvailable = null

try {
  faucetAvailable = await gmContract.canClaimFaucet(
    userAddress,
    { blockTag }
  )
  console.log('canClaimFaucet OK')
} catch (error) {
  console.warn('canClaimFaucet failed, continuing refresh:', error)
}

let faucetNextTime = null

try {
  faucetNextTime = await gmContract.nextFaucetTime(
    userAddress,
    { blockTag }
  )
  console.log('nextFaucetTime OK')
} catch (error) {
  console.warn('nextFaucetTime failed, continuing refresh:', error)
}

const latestBlock = await provider.getBlock('latest')
    const offset = Number(latestBlock.timestamp) - Math.floor(Date.now() / 1000)
setChainTimeOffset(offset)
    const newCurrentGlobalDay = Math.floor(Number(latestBlock.timestamp) / 60)

    const daysSinceLastGM =
      newCurrentGlobalDay - Number(userLastGMDay)
    console.log('userLastGMDay', Number(userLastGMDay))
    console.log('currentGlobalDay', newCurrentGlobalDay)
    console.log('daysSinceLastGM', daysSinceLastGM)
 let readableLastGM = 'Unknown'
let readableGMStatus = 'GM available now'

if (Number(userLastGMDay) === 0) {
  readableLastGM = 'never'
  readableGMStatus = 'GM available now'
} else if (daysSinceLastGM === 0) {
  readableLastGM = 'today'
  readableGMStatus = "Already GM'd today"
} else if (daysSinceLastGM === 1) {
  readableLastGM = 'yesterday'
  readableGMStatus = 'GM available now'
} else if (Number(availableFreezes) > 0) {
  readableLastGM = `${daysSinceLastGM} days ago`
  readableGMStatus = 'Missed day – freeze can save your streak'
} else {
  readableLastGM = `${daysSinceLastGM} days ago`
  readableGMStatus = 'Missed day — next GM will reset streak'
}

    console.log('UI UPDATE:', {
  streak: currentStreak.toString(),
  freezes: availableFreezes.toString(),
  cycleDay: currentCycleDay.toString(),
  phase: currentPhase.toString(),
  lastGMDay: userLastGMDay.toString(),
  anna: userAnnaBalance !== null
  ? ethers.formatUnits(userAnnaBalance, 18)
  : 'unavailable',
  faucet: faucetAvailable,
  gmStatus: readableGMStatus,
  lastGMText: readableLastGM,
})
    setAddress(userAddress)
    setStreak(currentStreak.toString())
    setFreezes(availableFreezes.toString())
    setCycleDay(currentCycleDay.toString())
    setPhase(currentPhase.toString())
    setLastGMDay(userLastGMDay.toString())

setLastGMText(readableLastGM)
    if (userAnnaBalance !== null) {
  setAnnaBalance(ethers.formatUnits(userAnnaBalance, 18))
}
    if (faucetAvailable !== null) {
  setCanClaimFaucet(faucetAvailable)
}
if (faucetNextTime !== null) {
  setNextFaucetTime(Number(faucetNextTime))
}
    setGmStatus(readableGMStatus)
  }

  async function connectWallet() {
    try {
      setStatus('Connecting wallet...')

      const ethProvider = await getEthereumProvider()

      await ethProvider.request({ method: 'eth_requestAccounts' })
      await switchToBaseMainnet(ethProvider)

      const provider = new ethers.BrowserProvider(ethProvider)

      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()
      const network = await provider.getNetwork()

      setAddress(userAddress)
      setNetworkName(`${network.name} / chainId ${network.chainId}`)
setLastGMText('')
      await refreshUserData(provider, userAddress)

      setStatus('Wallet connected')
    } catch (error) {
      console.error(error)
      setStatus(`Wallet connection failed: ${error.message}`)
    }
  }
  async function claimFaucet() {
    try {
      setIsLoading(true)
      setStatus('Claiming 10 ANNA...')

      const ethProvider = await getEthereumProvider()

      await ethProvider.request({ method: 'eth_requestAccounts' })
      await switchToBaseMainnet(ethProvider)

      const provider = new ethers.BrowserProvider(ethProvider)
      const signer = await provider.getSigner()

      const gmContract = new ethers.Contract(
        GM_CONTRACT_ADDRESS,
        GM_ABI,
        signer
      )

      const tx = await gmContract.faucet()
setStatus('Waiting for faucet transaction...')

const receipt = await tx.wait()

const userAddress = await signer.getAddress()

const readProvider = new ethers.JsonRpcProvider(
  import.meta.env.VITE_ALCHEMY_RPC_URL
)

let refreshDone = false

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await refreshUserData(
      readProvider,
      userAddress,
      receipt.blockNumber
    )
    refreshDone = true
    break
  } catch (error) {
    console.warn(`Faucet refresh attempt ${attempt} failed`, error)

    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 800))
    }
  }
}

if (!refreshDone) {
  throw new Error('Post-faucet refresh failed after 3 attempts')
}
      setStatus('10 ANNA claimed')
    } catch (error) {
      console.error(error)
      setStatus(`Faucet failed: ${error.shortMessage || error.message}`)
    } finally {
      setIsLoading(false)
    }
  }
  async function sendGM() {
    try {
      setIsLoading(true)
      setStatus('Preparing GM...')

      const ethProvider = await getEthereumProvider()

      await ethProvider.request({ method: 'eth_requestAccounts' })
      await switchToBaseMainnet(ethProvider)

      const provider = new ethers.BrowserProvider(ethProvider)
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()

      const annaToken = new ethers.Contract(
        ANNA_TOKEN_ADDRESS,
        ANNA_ABI,
        signer
      )

      const gmContract = new ethers.Contract(
        GM_CONTRACT_ADDRESS,
        GM_ABI,
        signer
      )

      const gmPrice = ethers.parseUnits('1', 18)
      const allowance = await annaToken.allowance(
        userAddress,
        GM_CONTRACT_ADDRESS
      )

      if (allowance < gmPrice) {
        setStatus('Approving ANNA for GM...')
        const approveTx = await annaToken.approve(
          GM_CONTRACT_ADDRESS,
          ethers.MaxUint256
        )

        setStatus('Waiting for approve transaction...')
        await approveTx.wait()
      }

      setStatus('Sending GM...')
      const gmTx = await gmContract.gm()

      setStatus('Waiting for GM transaction...')
      const receipt = await gmTx.wait()
      setAnnaBalance(prev =>
  prev !== null ? String(Number(prev) - 1) : prev
)

console.log(
  'Alchemy RPC loaded:',
  Boolean(import.meta.env.VITE_ALCHEMY_RPC_URL)
)

const readProvider = new ethers.JsonRpcProvider(
  import.meta.env.VITE_ALCHEMY_RPC_URL
)

let refreshDone = false

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await refreshUserData(
      readProvider,
      userAddress,
      receipt.blockNumber
    )
    refreshDone = true
    break
  } catch (error) {
    console.warn(`Refresh attempt ${attempt} failed`, error)

    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 800))
    }
  }
}

if (!refreshDone) {
  throw new Error('Post-GM refresh failed after 3 attempts')
}

      setStatus('GM sent! Brick received.')
    } catch (error) {
      console.error(error)

      const message = error.shortMessage || error.message || ''

  if (message.includes('Already GM today')) {
  setGmStatus("Already GM'd today")
  setLastGMText('today')
  setStatus("Oops, you have already GM'd today! Come back tomorrow 😉")
} else {
  setStatus(`GM failed: ${message}`)
} 
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app">
      <h1>Build your Base House. <br /> Add one brick with each GM.</h1>

      <div className="house-progress">
        <div
          className="house-progress-fill"
          style={{ width: `${(Number(cycleDay) / 60) * 100}%` }}
        />
      </div>

      {phase !== null && (
        <div className="house-container">
          <img
            className="house-image"
            src={houseImage}
            alt="House phase"
          />
        </div>
      )}

      <div className="button-row">
       <button
  onClick={connectWallet}
  disabled={!!address}
>
  {address ? (
    <>
      <span className="button-emoji">💳</span>
Wallet
<br />
      Connected
    </>
  ) : (
    <>
      <span className="button-emoji">💳</span>
      Connect
      <br />
      Wallet
    </>
  )}
</button>

        <button
  className="gm-button"
  onClick={sendGM}
  disabled={
  !address ||
  Number(annaBalance) < 1 ||
  isLoading ||
  gmStatus === "Already GM'd today"
}
>
  {gmStatus === "Already GM'd today" ? (
    <>
      ✅
      <br />
      Already
      <br />
      GM'd today😉
    </>
  ) : (
  <>
  <span className="button-emoji gm-emoji">☺️</span>
  <br />
  <span className="gm-text">GM</span>
</>
  )}
</button>

       <button
  onClick={claimFaucet}
  disabled={
  !address ||
  isLoading ||
  canClaimFaucet === false
}
>

 {canClaimFaucet === false ? (
  <>
    <span className="button-emoji">🚚</span>
    <br />
    New
    <br />
    shipment
    <br />
    soon
  </>
) : (
  <>
    <span className="button-emoji">
      {alleyMode ? '🌳' : '🧱'}
    </span>
    Claim
    <br />
    10
    <br />
    {alleyMode ? 'Saplings' : 'Bricks'}
  </>
)}

</button>

</div>

{lastGMText && (
  <>
    {Number(lastGMDay) === 0 ? (
      <p className="status">
        👋 Welcome! Time to lay your first brick.
      </p>
    ) : Number(cycleDay) === 60 ? (
      <p className="reward">
        🏡 Your cozy house is complete!
        <br />
        🎉 Congratulations! You're now a Master Builder.
        <br />
        🏅 Your Soulbound Certificate
         <br />
         is waiting in your wallet.
        <br />
        Check your NFT collection! 😉
      </p>
    ) : alleyMode && Number(cycleDay) === 61 ? (
      <p className="status">
        🏡 Your cozy house is complete!
        <br />
        🌳 Now it's time to grow the front alley.
        <br />
        🌱 Plant one sapling with each GM.
      </p>
    ) : (
      <p className="status">
        {Number(cycleDay) <= 15
          ? 'A strong house starts with a strong FOUNDATION.'
          : Number(cycleDay) <= 30
          ? 'Raising the WALLS, building the future.'
          : Number(cycleDay) <= 45
          ? 'A ROOF over your head.'
          : Number(cycleDay) <= 60
          ? "It's what's INSIDE that makes a house a home."
          : 'PLANT today, GROW for tomorrow.'}
      </p>
    )}

    <p className="status">
      🕘 Last visit: {lastGMText}
    </p>
  </>
)}

{gmStatus === 'Missed day – freeze can save your streak' && (
  <p className="warning">
    {alleyMode ? (
      <>
        🧑‍🌾 You've missed a day!
        <br />
        One garden tool will be used to restore the alley.
        </>
    ) : (
      <>
        👷 You've missed a day!
        <br />
        One trowel will be used to repair the wall.
      </>
    )}
  </p>
)}

{gmStatus === 'Missed day — next GM will reset streak' && (
  <p className="warning">
    {alleyMode ? (
      <>
        🧑‍🌾 You've missed a day!
        <br />
        Without garden tools,
        <br />
        weeds have taken over your alley.
        <br />
        It's time to start anew.
      </>
    ) : (
      <>
        👷 You've missed a day!
        <br />
        Without a trowel, your next brick will
        <br />
        restart the house anew.
      </>
    )}
  </p>
)}

{streak !== null && (
        <p className="status">☀️ Days in a row: {streak}</p>
      )}

 {freezes !== null && (
  <p className="status">
    {alleyMode ? '🪏' : '🪏'}{' '}
    {alleyMode ? 'Garden tools' : 'Trowels for repair'}: {freezes}
  </p>
)}

 {annaBalance !== null && (
  <p className="status">
    {alleyMode ? '🌿' : '🧱'}{' '}
    {alleyMode ? 'Saplings in storage' : 'Bricks in storage'}:{' '}
    {Number(annaBalance)}
  </p>
)}

{address && (
        <p className="wallet">
          💸 Active wallet: {address.slice(0, 6)}...{address.slice(-4)}
        </p>
      )}
     
    </main>
  )
}

export default App