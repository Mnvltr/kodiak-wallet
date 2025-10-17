import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Send, Clock, CheckCircle, XCircle, RefreshCw, Wallet, AlertCircle, Key, PlusCircle, MinusCircle, Eye, EyeOff, Settings, User } from 'lucide-react';
import { connect, disconnect } from 'get-starknet';
import { Contract, Provider, cairo, hash, ec } from 'starknet';

// CONFIGURATION
const CONFIG = {
  contractAddress: '0x06dddc3d870b18006bf59b1b33e21a576aa79a7b34a739ba04f2699c3da25173',
  strkTokenAddress: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
  rpcUrls: [
    'https://starknet-sepolia.public.blastapi.io',
    'https://starknet-sepolia.drpc.org',
    'https://sepolia.starknet.io',
    'https://rpc.starknet-sepolia.lava.build'
  ],
  network: 'sepolia',
  contractAbi: [
    {
      "name": "create_offline_account",
      "type": "function",
      "inputs": [
        {"name": "public_key", "type": "felt"},
        {"name": "initial_deposit", "type": "u256"}
      ],
      "outputs": [{"name": "account_id", "type": "felt"}]
    },
    {
      "name": "deposit_to_offline_account",
      "type": "function",
      "inputs": [
        {"name": "offline_account_id", "type": "felt"},
        {"name": "amount", "type": "u256"}
      ]
    },
    {
      "name": "withdraw_from_offline_account",
      "type": "function",
      "inputs": [
        {"name": "offline_account_id", "type": "felt"},
        {"name": "amount", "type": "u256"}
      ]
    },
    {
      "name": "execute_offline_transfer",
      "type": "function",
      "inputs": [
        {"name": "offline_account_id", "type": "felt"},
        {"name": "to", "type": "ContractAddress"},
        {"name": "amount", "type": "u256"},
        {"name": "nonce", "type": "felt"},
        {"name": "signature_r", "type": "felt"},
        {"name": "signature_s", "type": "felt"}
      ],
      "outputs": [{"name": "success", "type": "bool"}]
    },
    {
      "name": "get_offline_account_owner",
      "type": "function",
      "stateMutability": "view",
      "inputs": [{"name": "offline_account_id", "type": "felt"}],
      "outputs": [{"name": "owner", "type": "felt"}]
    },
    {
      "name": "get_offline_account_balance",
      "type": "function",
      "stateMutability": "view",
      "inputs": [{"name": "offline_account_id", "type": "felt"}],
      "outputs": [{"name": "balance", "type": "u256"}]
    },
    {
      "name": "get_offline_account_nonce",
      "type": "function",
      "stateMutability": "view",
      "inputs": [{"name": "offline_account_id", "type": "felt"}],
      "outputs": [{"name": "nonce", "type": "felt"}]
    }
  ]
};

const OfflineTransferApp = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wallet, setWallet] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [currentNonce, setCurrentNonce] = useState(0);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [pendingTxs, setPendingTxs] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState('0');
  
  // Offline account
  const [offlineAccountId, setOfflineAccountId] = useState('');
  const [offlineBalance, setOfflineBalance] = useState('0');
  const [offlineNonce, setOfflineNonce] = useState(0);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  
  // Local signature
  const [localPrivKey, setLocalPrivKey] = useState('');
  const [localPublicKey, setLocalPublicKey] = useState('');
  const [useLocalSigner, setUseLocalSigner] = useState(false);

  // Online Transfer
  const [onlineRecipient, setOnlineRecipient] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');

  // Offline funding
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Offline Transfer
  const [offlineRecipient, setOfflineRecipient] = useState('');
  const [offlineAmount, setOfflineAmount] = useState('');
  const [offlineTransactionQueue, setOfflineTransactionQueue] = useState([]);
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [includeGasFees, setIncludeGasFees] = useState(false);

  // Electron wallet connection states
  const [isConnected, setIsConnected] = useState(false);
  const [connectionSource, setConnectionSource] = useState(null); // 'electron' | 'direct'

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onWalletConnected) {
      window.electronAPI.onWalletConnected((walletData) => {
        console.log('Wallet data received from Electron:', walletData);
        if (walletData.address) {
          setWalletAddress(walletData.address);
          setIsConnected(true);
          setConnectionSource('electron');
          setStatusMessage('✅ WALLET CONNECTED FROM ELECTRON - OFFLINE MODE AVAILABLE');
        }
      });
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatusMessage('✅ CONNECTION ESTABLISHED. PENDING TRANSACTIONS CAN BE SENT');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setStatusMessage('⚠️ OFFLINE MODE. TRANSACTIONS WILL BE SIGNED LOCALLY.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const createProvider = async () => {
      for (const rpcUrl of CONFIG.rpcUrls) {
        try {
          const testProvider = new Provider({ 
            nodeUrl: rpcUrl,
            retries: 2,
            timeout: 10000
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('RPC timeout')), 8000)
          );
          
          await Promise.race([
            testProvider.getBlock('latest'),
            timeoutPromise
          ]);
          
          console.log(`✅ Connected to RPC: ${rpcUrl}`);
          setProvider(testProvider);
          return;
        } catch (error) {
          console.warn(`❌ RPC failed ${rpcUrl}:`, error.message);
          continue;
        }
      }
      console.error('❌ All RPCs failed');
      setStatusMessage('❌ COULD NOT CONNECT TO ANY STARKNET RPC');
    };

    createProvider();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const verifyOfflineAccountExists = async (accountId) => {
    if (!provider || !accountId) {
      console.warn('❌ Provider or accountId not available for verification');
      return false;
    }

    try {
      console.log(`🔍 Verifying offline account ID existence: ${accountId}`);
      
      // Try to get the account owner
      const ownerResult = await provider.callContract({
        contractAddress: CONFIG.contractAddress,
        entrypoint: 'get_offline_account_owner',
        calldata: [accountId]
      });

      console.log('🔍 Owner query result:', JSON.stringify(ownerResult, null, 2));

      // Check if the owner is a valid address (not zero)
      let ownerAddress = null;
      if (ownerResult && ownerResult.result && Array.isArray(ownerResult.result) && ownerResult.result.length > 0) {
        ownerAddress = ownerResult.result[0];
      } else if (Array.isArray(ownerResult) && ownerResult.length > 0) {
        ownerAddress = ownerResult[0];
      }

      const isValidOwner = ownerAddress && ownerAddress !== '0x0' && ownerAddress !== '0';
      
      console.log(`🔍 Account verification:`, {
        accountId,
        ownerAddress,
        isValidOwner,
        ownerAddressBigInt: ownerAddress ? BigInt(ownerAddress).toString() : 'null'
      });

      return isValidOwner;
    } catch (error) {
      console.error(`❌ Error verifying offline account ${accountId}:`, error);
      return false;
    }
  };

  const generateLocalAccount = async () => {
    if (!wallet) {
      setStatusMessage('❌ CONNECT YOUR WALLET FIRST');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage('🎲 GENERATING KEY PAIR...');
      
      // Generate key pair
      const privateKey = ec.starkCurve.utils.randomPrivateKey();
      const privateKeyHex = '0x' + Array.from(privateKey)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const publicKey = ec.starkCurve.getStarkKey(privateKey);
      
      setLocalPrivKey(privateKeyHex);
      setLocalPublicKey(publicKey);
      
      console.log('Generated keys:', {
        privateKey: privateKeyHex,
        publicKey: publicKey
      });
      
      setStatusMessage('✅ KEYS GENERATED. CREATING ACCOUNT IN CONTRACT...');

      await createOfflineAccountWithKeys(publicKey);
      
    } catch (error) {
      console.error('Error generating keys:', error);
      setStatusMessage('❌ ERROR GENERATING KEYS: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Create offline account
  const createOfflineAccountWithKeys = async (publicKey) => {
    try {
      setStatusMessage('📝 CREATING OFFLINE ACCOUNT IN CONTRACT...');

      // Convert public key to felt
      const publicKeyFelt = BigInt(publicKey).toString();

      console.log('🚀 STARTING OFFLINE ACCOUNT CREATION:', {
        publicKey: publicKey,
        publicKeyFelt: publicKeyFelt,
        walletAddress: walletAddress
      });

      const result = await wallet.account.execute({
        contractAddress: CONFIG.contractAddress,
        entrypoint: 'create_offline_account',
        calldata: [
          publicKeyFelt,
          '0', // No initial deposit - low
          '0'  // No initial deposit - high
        ]
      });

      setStatusMessage('⏳ WAITING FOR TRANSACTION CONFIRMATION...');
      console.log('📤 Tx sent:', result.transaction_hash);
      
      const receipt = await provider.waitForTransaction(result.transaction_hash);
      console.log('📋 COMPLETE RECEIPT:', JSON.stringify(receipt, null, 2));

      console.log('🔍 ANALYZING EVENTS...');
      
      if (!receipt.events || receipt.events.length === 0) {
        throw new Error('No events found in transaction receipt');
      }

      const eventSelector = hash.getSelectorFromName('OfflineAccountCreated');
      console.log('🔍 Looking for event with selector:', eventSelector);
      
      const targetEvent = receipt.events.find(event => {
        console.log('🔍 Comparing event:', {
          eventKeys: event.keys,
          firstKey: event.keys[0],
          targetSelector: eventSelector,
          match: event.keys[0] === eventSelector
        });
        return event.keys[0] === eventSelector;
      });

      if (!targetEvent) {
        console.error('❌ EVENT NOT FOUND. Available events:');
        receipt.events.forEach((event, index) => {
          console.log(`Event ${index}:`, {
            keys: event.keys,
            data: event.data,
            from_address: event.from_address
          });
        });
        throw new Error('OfflineAccountCreated event not found');
      }

      console.log('🎯 EVENT FOUND:', JSON.stringify(targetEvent, null, 2));
      
      let extractedAccountId;
      if (targetEvent.keys.length >= 2) {
        extractedAccountId = targetEvent.keys[1]; // First key field after selector
      } else if (targetEvent.data.length >= 1) {
        extractedAccountId = targetEvent.data[0]; // Fallback: first element in data
      } else {
        throw new Error('Could not extract account ID from event');
      }

      const accountId = BigInt(extractedAccountId).toString();
      
      console.log('📋 ID EXTRACTED AND PROCESSED:', {
        rawValue: extractedAccountId,
        cleanId: accountId,
        asBigInt: BigInt(extractedAccountId).toString()
      });

      setStatusMessage('🔍 VERIFYING THAT ACCOUNT WAS CREATED CORRECTLY...');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const accountExists = await verifyOfflineAccountExists(accountId);
      
      if (!accountExists) {
        throw new Error(`The offline account ${accountId} was not created correctly in the contract. Storage may be inconsistent.`);
      }

      setOfflineAccountId(accountId);
      setOfflineBalance('0');
      setOfflineNonce(0);

      setStatusMessage(`✅ OFFLINE ACCOUNT CREATED SUCCESSFULLY! ID: ${accountId}. EXISTENCE VERIFICATION: OK`);
      
      setTimeout(() => {
        refreshOfflineAccountData(accountId);
      }, 2000);

    } catch (error) {
      console.error('❌ DETAILED ERROR creating offline account:', error);
      setStatusMessage('❌ ERROR: ' + (error.message || 'UNKNOWN ERROR'));
      
      // Clear state on error
      setOfflineAccountId('');
      setOfflineBalance('0');
      setOfflineNonce(0);
    }
  };

  const refreshOfflineAccountData = async (accountId = offlineAccountId, retries = 3, delay = 2000) => {
    if (!accountId || !provider) {
      console.log('❌ Cannot refresh: missing accountId or provider');
      return;
    }

    const currentAccountId = accountId || offlineAccountId;
    if (!currentAccountId) {
      console.log('❌ No valid account ID to query');
      return;
    }

    setIsRefreshingBalance(true);
    console.log(`🔄 Refreshing account data ${currentAccountId} (attempt ${4-retries}/3)`);
    console.log(`🔍 Current state: offlineAccountId=${offlineAccountId}, parameter=${accountId}`);

    try {
      // STEP 1: Verify that the account exists
      const accountExists = await verifyOfflineAccountExists(currentAccountId);
      if (!accountExists) {
        throw new Error(`The offline account ${currentAccountId} does not exist in the contract`);
      }

      // STEP 2: Get balance
      console.log('📊 Querying balance...');
      const balanceResult = await provider.callContract({
        contractAddress: CONFIG.contractAddress,
        entrypoint: 'get_offline_account_balance',
        calldata: [currentAccountId]
      });

      console.log('🔍 COMPLETE BALANCE RESPONSE:', JSON.stringify(balanceResult, null, 2));
      
      let balanceData = null;
      if (balanceResult && balanceResult.result && Array.isArray(balanceResult.result) && balanceResult.result.length >= 2) {
        balanceData = {
          low: balanceResult.result[0],
          high: balanceResult.result[1]
        };
      } else if (Array.isArray(balanceResult) && balanceResult.length >= 2) {
        balanceData = {
          low: balanceResult[0],
          high: balanceResult[1]
        };
      }

      if (!balanceData) {
        throw new Error('Could not get offline account balance');
      }

      const low = BigInt(balanceData.low || 0);
      const high = BigInt(balanceData.high || 0);
      const balanceWei = low + (high << 128n);
      const balanceInStrk = (Number(balanceWei) / 1e18).toFixed(6);
      
      console.log('💰 Calculated balance:', {
        low: low.toString(),
        high: high.toString(),
        balanceWei: balanceWei.toString(),
        balanceInStrk
      });

      // STEP 3: Get nonce
      console.log('📊 Querying nonce...');
      const nonceResult = await provider.callContract({
        contractAddress: CONFIG.contractAddress,
        entrypoint: 'get_offline_account_nonce',
        calldata: [currentAccountId]
      });

      console.log('🔍 COMPLETE NONCE RESPONSE:', JSON.stringify(nonceResult, null, 2));

      let nonce = 0;
      if (nonceResult && nonceResult.result && Array.isArray(nonceResult.result)) {
        nonce = parseInt(nonceResult.result[0] || 0);
      } else if (Array.isArray(nonceResult)) {
        nonce = parseInt(nonceResult[0] || 0);
      }

      console.log('🔢 Nonce obtained:', nonce);

      setOfflineBalance(balanceInStrk);
      setOfflineNonce(nonce);
      
      console.log('✅ Account data updated successfully:', {
        accountId: currentAccountId,
        balance: balanceInStrk,
        nonce
      });

    } catch (error) {
      console.error(`❌ Error refreshing account data (attempt ${4-retries}/3):`, error);
      
      if (retries > 1) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        setTimeout(() => {
          refreshOfflineAccountData(accountId, retries - 1, delay);
        }, delay);
      } else {
        console.error('❌ Maximum retries reached');
      }
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  const depositToOfflineAccount = async () => {
    if (!wallet || !contract) {
      setStatusMessage('❌ CONNECT YOUR WALLET FIRST');
      return;
    }

    if (!offlineAccountId) {
      setStatusMessage('❌ FIRST CREATE OR LOAD AN OFFLINE ACCOUNT');
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setStatusMessage('❌ ENTER A VALID AMOUNT TO DEPOSIT');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage('🔍 VERIFYING OFFLINE ACCOUNT BEFORE DEPOSITING...');

      // CRITICAL VALIDATION: Verify that the account exists
      const accountExists = await verifyOfflineAccountExists(offlineAccountId);
      if (!accountExists) {
        throw new Error(`The offline account ${offlineAccountId} does not exist in the contract. Create it first using "Create Account in Contract".`);
      }

      setStatusMessage('✅ ACCOUNT VERIFIED. DEPOSITING FUNDS...');

      const amountFloat = parseFloat(depositAmount);
      let amountInWei = BigInt(Math.floor(amountFloat * 1e18));

      // Step 1: Approve tokens
      setStatusMessage('APPROVING STRK TOKENS...');
      const approvalResult = await wallet.account.execute({
        contractAddress: CONFIG.strkTokenAddress,
        entrypoint: 'approve',
        calldata: [
          CONFIG.contractAddress,
          cairo.uint256(amountInWei).low.toString(),
          cairo.uint256(amountInWei).high.toString()
        ]
      });
      
      console.log('✅ Approval sent:', approvalResult.transaction_hash);
      await provider.waitForTransaction(approvalResult.transaction_hash);
      console.log('✅ Approval confirmed');

      // Step 2: Deposit to offline account
      setStatusMessage('DEPOSITING FUNDS...');
      
      console.log('📤 DEPOSITING WITH PARAMETERS:', {
        contractAddress: CONFIG.contractAddress,
        offlineAccountId: offlineAccountId,
        amountInWei: amountInWei.toString(),
        lowHigh: cairo.uint256(amountInWei)
      });
      
      const depositResult = await wallet.account.execute({
        contractAddress: CONFIG.contractAddress,
        entrypoint: 'deposit_to_offline_account',
        calldata: [
          offlineAccountId,
          cairo.uint256(amountInWei).low.toString(),
          cairo.uint256(amountInWei).high.toString()
        ]
      });

      console.log('✅ Deposit sent:', depositResult.transaction_hash);
      await provider.waitForTransaction(depositResult.transaction_hash);
      console.log('✅ Deposit confirmed');

      setStatusMessage('✅ TRANSACTIONS CONFIRMED. UPDATING BALANCE...');

      setTimeout(() => {
        refreshOfflineAccountData();
      }, 3000);

      if (includeGasFees) {
        setStatusMessage(`✅ SUCCESSFUL DEPOSIT: ${depositAmount} STRK + 0.01 GAS DEPOSITED TO OFFLINE ACCOUNT`);
      } else {
        setStatusMessage(`✅ SUCCESSFUL DEPOSIT: ${depositAmount} STRK DEPOSITED TO OFFLINE ACCOUNT`);
      }
      setDepositAmount('');

    } catch (error) {
      console.error('❌ Error depositing funds:', error);
      
      if (error.message && error.message.includes('Offline account not found')) {
        setStatusMessage('❌ ERROR: THE OFFLINE ACCOUNT DOES NOT EXIST IN THE CONTRACT. USE "CREATE ACCOUNT IN CONTRACT" FIRST.');
      } else {
        setStatusMessage('❌ ERROR: ' + (error.message || 'UNKNOWN ERROR'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingOfflineAccount = async () => {
    const accountId = prompt('ENTER THE OFFLINE ACCOUNT ID:');
    if (!accountId) return;

    const privKey = prompt('ENTER THE OFFLINE ACCOUNT PRIVATE KEY:');
    if (!privKey) return;

    try {
      setIsLoading(true);
      setStatusMessage('LOADING OFFLINE ACCOUNT...');

      // Verify that the account exists
      const accountExists = await verifyOfflineAccountExists(accountId);
      if (!accountExists) {
        throw new Error(`The offline account ${accountId} does not exist in the contract`);
      }

      let cleanPrivKey = privKey.trim();
      if (!cleanPrivKey.startsWith('0x')) {
        cleanPrivKey = '0x' + cleanPrivKey;
      }

      const privKeyBytes = new Uint8Array(
        cleanPrivKey.slice(2).match(/.{1,2}/g).map(byte => parseInt(byte, 16))
      );

      const publicKey = ec.starkCurve.getStarkKey(privKeyBytes);

      setOfflineAccountId(accountId);
      setLocalPrivKey(cleanPrivKey);
      setLocalPublicKey(publicKey);

      await refreshOfflineAccountData(accountId);
      setStatusMessage('✅ OFFLINE ACCOUNT LOADED SUCCESSFULLY!');
    } catch (error) {
      console.error('Error loading account:', error);
      setStatusMessage('❌ ERROR: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const signTransactionOffline = async () => {
    if (!localPrivKey || !offlineAccountId) {
      setStatusMessage('❌ NO LOCAL KEYS OR OFFLINE ACCOUNT AVAILABLE');
      return;
    }

    if (!offlineRecipient || !offlineAmount || parseFloat(offlineAmount) <= 0) {
      setStatusMessage('❌ ENTER VALID RECIPIENT AND AMOUNT');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage('✍️ SIGNING OFFLINE TRANSACTION WITH POSEIDON HASH...');

      const amountFloat = parseFloat(offlineAmount);
      const currentBalance = parseFloat(offlineBalance);
      
      if (amountFloat > currentBalance) {
        setStatusMessage(`❌ INSUFFICIENT BALANCE. YOU HAVE ${offlineBalance} STRK, TRYING TO TRANSFER ${offlineAmount} STRK.`);
        setIsLoading(false);
        return;
      }

      const amountInWei = BigInt(Math.floor(amountFloat * 1e18));

      // Create transaction data
      const transactionData = {
        from: offlineAccountId,
        to: offlineRecipient,
        amount: amountInWei.toString(),
        nonce: offlineNonce,
        timestamp: Date.now()
      };

      console.log('🔢 Transaction data:', transactionData);

      // Create data array for hash
      const amountU256 = cairo.uint256(amountInWei);
      const messageToSign = [
        BigInt(offlineAccountId),
        BigInt(offlineRecipient), 
        BigInt(amountU256.low),
        BigInt(amountU256.high),
        BigInt(offlineNonce)
      ];

      console.log('📝 Message to sign (corrected to match contract):', messageToSign);
      console.log('📝 Amount u256:', amountU256);

      const messageHashHex = hash.computePoseidonHashOnElements(messageToSign);
      console.log('🔐 Poseidon hash calculated:', messageHashHex);

      // Sign using the official documented function
      const signature = ec.starkCurve.sign(messageHashHex, localPrivKey);
      console.log('✍️ Signature generated:', signature);

      const signedTransaction = {
        ...transactionData,
        messageHash: messageHashHex,
        signature: {
          r: signature.r.toString(),
          s: signature.s.toString()
        },
        id: Date.now()
      };

      setOfflineTransactionQueue(prev => [...prev, signedTransaction]);
      setOfflineNonce(prev => prev + 1);
      
      setOfflineRecipient('');
      setOfflineAmount('');
      
      setStatusMessage('✅ TRANSACTION SIGNED AND ADDED TO QUEUE (POSEIDON HASH)');
      console.log('✅ Transaction added to queue:', signedTransaction);

    } catch (error) {
      console.error('❌ Error signing transaction:', error);
      setStatusMessage('❌ SIGNING ERROR: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // CORRECTED FUNCTION: Withdraw funds
  const withdrawFromOfflineAccount = async () => {
    if (!wallet || !contract) {
      setStatusMessage('❌ CONNECT YOUR WALLET FIRST');
      return;
    }

    if (!offlineAccountId) {
      setStatusMessage('❌ FIRST CREATE OR LOAD AN OFFLINE ACCOUNT');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setStatusMessage('❌ ENTER A VALID AMOUNT TO WITHDRAW');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage('💸 PROCESSING WITHDRAWAL...');

      const amountFloat = parseFloat(withdrawAmount);
      const amountInWei = BigInt(Math.floor(amountFloat * 1e18));

      const withdrawResult = await wallet.account.execute({
        contractAddress: CONFIG.contractAddress,
        entrypoint: 'withdraw_from_offline_account',
        calldata: [
          offlineAccountId,
          cairo.uint256(amountInWei).low.toString(),
          cairo.uint256(amountInWei).high.toString()
        ]
      });

      console.log('✅ Withdrawal sent:', withdrawResult.transaction_hash);
      await provider.waitForTransaction(withdrawResult.transaction_hash);

      setWithdrawAmount('');
      await refreshOfflineAccountData();
      setStatusMessage('✅ WITHDRAWAL COMPLETED SUCCESSFULLY');

    } catch (error) {
      console.error('❌ Withdrawal error:', error);
      setStatusMessage('❌ WITHDRAWAL ERROR: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const processTransactionQueue = async () => {
    if (!wallet || !isOnline || offlineTransactionQueue.length === 0) {
      setStatusMessage('❌ NO TRANSACTIONS TO PROCESS OR NO CONNECTION');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage('🔄 STARTING ACCOUNT STATE UPDATE...');
      
      console.log('🚀 PROCESSING TRANSACTION QUEUE:', {
        totalTransactions: offlineTransactionQueue.length,
        transactions: offlineTransactionQueue
      });

      let successCount = 0;
      let failureCount = 0;
      const results = [];

      for (let i = 0; i < offlineTransactionQueue.length; i++) {
        const tx = offlineTransactionQueue[i];
        
        try {
          setStatusMessage(`🔄 PROCESSING TRANSACTION ${i + 1}/${offlineTransactionQueue.length}...`);
          console.log(`🔄 Processing transaction ${i + 1}:`, tx);

          // Prepare calldata for execute_offline_transfer
          const calldata = [
            tx.from, // offline_account_id
            tx.to,   // to (ContractAddress)
            cairo.uint256(BigInt(tx.amount)).low.toString(),  // amount.low
            cairo.uint256(BigInt(tx.amount)).high.toString(), // amount.high
            tx.nonce.toString(), // nonce
            tx.signature.r,      // signature_r
            tx.signature.s       // signature_s
          ];

          console.log('📤 Calldata prepared:', calldata);

          const executeResult = await wallet.account.execute({
            contractAddress: CONFIG.contractAddress,
            entrypoint: 'execute_offline_transfer',
            calldata: calldata
          });

          console.log('✅ Execution result:', executeResult);

          // Wait for transaction confirmation
          const receipt = await provider.waitForTransaction(executeResult.transaction_hash);
          console.log('📋 Transaction receipt:', receipt);

          successCount++;
          results.push({ 
            id: tx.id, 
            status: 'success', 
            txHash: executeResult.transaction_hash,
            message: `Transfer of ${(BigInt(tx.amount) / BigInt(1e18)).toString()} STRK executed`
          });

        } catch (error) {
          console.error(`❌ Error processing transaction ${i + 1}:`, error);
          failureCount++;
          results.push({ 
            id: tx.id, 
            status: 'failed', 
            error: error.message 
          });
        }

        // Small pause between transactions
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Show summary
      console.log('📊 Update summary:', { successCount, failureCount, results });

      if (successCount > 0) {
        // Clear successful transactions from queue
        const failedTransactions = offlineTransactionQueue.filter(tx => {
          const result = results.find(r => r.id === tx.id);
          return result && result.status === 'failed';
        });
        setOfflineTransactionQueue(failedTransactions);

        // Update account data
        setTimeout(() => {
          refreshOfflineAccountData();
        }, 2000);
      }

      setStatusMessage(
        `✅ UPDATE COMPLETED: ${successCount} SUCCESSFUL, ${failureCount} FAILED`
      );

    } catch (error) {
      console.error('❌ Error in state update:', error);
      setStatusMessage(`❌ STATE UPDATE ERROR: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    if (window.electronAPI && connectionSource === 'electron' && walletAddress) {
      setStatusMessage('✅ ALREADY CONNECTED VIA ELECTRON - READY FOR OFFLINE MODE');
      return;
    }

    if (window.electronAPI) {
      // Electron environment - redirect to web version
      const url = `https://kodiak-wallet.vercel.app?from=electron&callback=kodiak://wallet-connected`;
      window.electronAPI.openExternal(url);
      return;
    }

    // Check if this is a callback from Electron (web environment)
    const urlParams = new URLSearchParams(window.location.search);
    const fromElectron = urlParams.get('from');
    const callback = urlParams.get('callback');

    if (fromElectron === 'electron' && callback) {
      // web version being called from Electron
      // Connect normally and then redirect back
      try {
        const starknet = await connect({ modalMode: 'alwaysAsk' });
        if (starknet) {
          await starknet.enable();
          if (starknet.isConnected && starknet.selectedAddress) {
            // Show success message briefly before redirect
            document.body.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white; font-family: monospace; text-align: center;">
                <div>
                  <h2>✅ Billetera Conectada</h2>
                  <p>Dirección: ${starknet.selectedAddress}</p>
                  <p>Redirigiendo a Kodiak Wallet...</p>
                </div>
              </div>
            `;
            
            // Wait a moment then redirect
            setTimeout(() => {
              window.location.href = `${callback}?address=${starknet.selectedAddress}`;
            }, 2000);
            return;
          }
        }
      } catch (error) {
        console.error('Error connecting wallet for Electron:', error);
        alert('Error al conectar con la billetera. Asegúrate de tener ArgentX o Braavos instalados.');
        return;
      }
    }

    // Normal web browser behavior - show wallet modal
    setShowWalletModal(true);
  };

  const handleWalletConnection = async (walletId = null) => {
    try {
      setIsLoading(true);
      setShowWalletModal(false);
      setStatusMessage('CONNECTING WALLET...');

      let starknet = null;
      
      if (walletId) {
        // Try specific wallet first
        try {
          starknet = await connect({ modalMode: 'neverAsk', walletId });
        } catch (error) {
          console.warn(`Failed to connect to ${walletId}, trying auto-detect...`);
          // Fallback to auto-detect if specific wallet fails
          try {
            starknet = await connect({ modalMode: 'alwaysAsk' });
          } catch (fallbackError) {
            console.error('Auto-detect also failed:', fallbackError);
            starknet = null;
          }
        }
      } else {
        // Auto-detect mode
        try {
          starknet = await connect({ modalMode: 'alwaysAsk' });
        } catch (error) {
          console.error('Auto-detect failed:', error);
          starknet = null;
        }
      }

      if (!starknet) {
        throw new Error('No wallet found, wallet connection cancelled, or no compatible wallet installed. Please make sure you have ArgentX or Braavos installed and try again.');
      }

      await starknet.enable();
      
      if (!starknet.isConnected) {
        throw new Error('Wallet connection was not established properly. Please try again.');
      }
      
      if (starknet && starknet.isConnected) {
        setWallet({ account: starknet.account, provider: starknet.provider });
        setWalletAddress(starknet.selectedAddress);
        setIsConnected(true);
        setConnectionSource('direct');

        // Get current nonce
        const nonce = await starknet.account.getNonce();
        setCurrentNonce(nonce);

        const contractInstance = new Contract(CONFIG.contractAbi, CONFIG.contractAddress, starknet.provider);
        contractInstance.connect(starknet.account);
        setContract(contractInstance);

        // Get STRK balance using provider
        try {
          if (provider) {
            const balanceResult = await provider.callContract({
              contractAddress: CONFIG.strkTokenAddress,
              entrypoint: 'balanceOf',
              calldata: [starknet.selectedAddress]
            });

            console.log('🔍 Balance result:', balanceResult);
            
            let balanceData = null;
            if (balanceResult && balanceResult.result && Array.isArray(balanceResult.result) && balanceResult.result.length >= 2) {
              balanceData = {
                low: balanceResult.result[0],
                high: balanceResult.result[1]
              };
            } else if (Array.isArray(balanceResult) && balanceResult.length >= 2) {
              balanceData = {
                low: balanceResult[0],
                high: balanceResult[1]
              };
            }

            if (balanceData) {
              const low = BigInt(balanceData.low || 0);
              const high = BigInt(balanceData.high || 0);
              const balanceWei = low + (high << 128n);
              const balanceInStrk = (Number(balanceWei) / 1e18).toFixed(6);
              setBalance(balanceInStrk);
            } else {
              console.log('❌ Error getting balance:', balanceResult);
              setBalance('0.000000');
            }
          }
        } catch (balanceError) {
          console.error('❌ Error getting balance:', balanceError);
          setBalance('0.000000');
        }

        setStatusMessage('✅ WALLET CONNECTED SUCCESSFULLY');
      }
    } catch (error) {
      console.error('❌ Error connecting wallet:', error);
      setStatusMessage(`❌ WALLET CONNECTION ERROR: ${error.message}`);
      setShowWalletModal(true); // Show modal again for retry
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      if (wallet) {
        await disconnect();
      }
      setWallet(null);
      setWalletAddress('');
      setCurrentNonce(0);
      setBalance('0');
      setIsConnected(false);
      setConnectionSource(null);
      setStatusMessage('WALLET DISCONNECTED');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const typewriterStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=IBM+Plex+Mono:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Inconsolata:wght@400;700&display=swap');
    
    * {
      font-family: 'IBM Plex Mono', 'Courier Prime', 'JetBrains Mono', 'Inconsolata', 'Courier New', monospace !important;
      letter-spacing: 0.05rem;
    }
    
    .typewriter-title {
      font-family: 'JetBrains Mono', monospace !important;
      font-weight: 700;
      letter-spacing: 0.15rem;
      text-transform: uppercase;
      text-shadow: 2px 2px 0px rgba(255, 255, 255, 0.1);
    }
    
    .typewriter-body {
      font-family: 'IBM Plex Mono', monospace !important;
      font-weight: 400;
      letter-spacing: 0.03rem;
    }
    
    .typewriter-mono {
      font-family: 'Courier Prime', monospace !important;
      font-weight: 400;
      letter-spacing: 0.02rem;
    }
    
    .typewriter-label {
      font-family: 'Inconsolata', monospace !important;
      font-weight: 500;
      letter-spacing: 0.08rem;
      text-transform: uppercase;
    }
    
    /* BLACK & WHITE THEME */
    .bg-black { background-color: #000000 !important; }
    .bg-dark-black { background-color: #0a0a0a !important; }
    .bg-darker-black { background-color: #121212 !important; }
    .bg-darkest-black { background-color: #1a1a1a !important; }
    
    .text-white { color: #ffffff !important; }
    .text-light-gray { color: #e0e0e0 !important; }
    .text-gray { color: #cccccc !important; }
    .text-dark-gray { color: #888888 !important; }
    .text-very-dark-gray { color: #666666 !important; }
    
    .border-white { border-color: #ffffff !important; }
    .border-light-gray { border-color: #cccccc !important; }
    .border-gray { border-color: #888888 !important; }
    .border-dark-gray { border-color: #444444 !important; }
    
    /* WHITE AND BLACK BUTTONS */
    .btn-white {
      background-color: #ffffff;
      color: #000000;
      border: 2px solid #ffffff;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1rem;
      transition: all 0.2s ease;
    }
    
    .btn-white:hover {
      background-color: #000000;
      color: #ffffff;
      border-color: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(255, 255, 255, 0.2);
    }
    
    .btn-white:disabled {
      background-color: #666666;
      color: #cccccc;
      border-color: #666666;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    .btn-black {
      background-color: #000000;
      color: #ffffff;
      border: 2px solid #ffffff;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1rem;
      transition: all 0.2s ease;
    }
    
    .btn-black:hover {
      background-color: #ffffff;
      color: #000000;
      border-color: #000000;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }
    
    .btn-black:disabled {
      background-color: #444444;
      color: #888888;
      border-color: #444444;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    /* BLACK AND WHITE INPUTS */
    .input-typewriter {
      background-color: #000000;
      color: #ffffff;
      border: 2px solid #cccccc;
      font-family: 'Courier Prime', monospace !important;
      letter-spacing: 0.05rem;
      transition: all 0.2s ease;
    }
    
    .input-typewriter:focus {
      outline: none;
      border-color: #ffffff;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
    }
    
    .input-typewriter::placeholder {
      color: #666666;
      font-style: italic;
    }
    
    /* MINIMALIST EFFECTS */
    .card-black {
      background-color: #000000;
      border: 1px solid #333333;
      transition: all 0.2s ease;
    }
    
    .card-black:hover {
      border-color: #ffffff;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
    }
    
    .pulse-white {
      animation: pulseWhite 2s infinite;
    }
    
    @keyframes pulseWhite {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }
    
    .glow-effect {
      animation: glowWhite 2s ease-in-out infinite alternate;
    }
    
    @keyframes glowWhite {
      from { text-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
      to { text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.3); }
    }
    
    /* CUSTOM CHECKBOX */
    .checkbox-typewriter {
      appearance: none;
      width: 20px;
      height: 20px;
      border: 2px solid #ffffff;
      background-color: #000000;
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
    }
    
    .checkbox-typewriter:checked {
      background-color: #ffffff;
      border-color: #ffffff;
    }
    
    .checkbox-typewriter:checked::after {
      content: '✓';
      position: absolute;
      top: -2px;
      left: 2px;
      color: #000000;
      font-weight: bold;
      font-size: 14px;
    }
    
    /* CUSTOM SCROLLBAR */
    ::-webkit-scrollbar {
      width: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #000000;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #ffffff;
      border-radius: 0;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #cccccc;
    }
  `;

  return (
    <>
      <style>{typewriterStyles}</style>
      <div className="min-h-screen bg-black text-white">
        {/* MINIMALIST BLACK AND WHITE HEADER */}
        <div className="bg-dark-black border-b border-white">
          <div className="max-w-6xl mx-auto p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl typewriter-title text-white glow-effect">
                  KODIAK.<span className={`text-2xl typewriter-body ${isOnline ? 'text-white' : 'text-white'}`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                </h1>
                
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="text-white pulse-white" size={20} />
                  ) : (
                    <WifiOff className="text-white pulse-white" size={20} />
                  )}
                </div>
              </div>

              {/* WALLET CONNECTION */}
              <div className="flex items-center gap-4">
                {!isConnected ? (
                  <button
                    onClick={connectWallet}
                    disabled={isLoading}
                    className="btn-white px-4 py-2 rounded typewriter-body"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="animate-spin" size={16} />
                        CONNECTING...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Wallet size={16} />
                        CONNECT.WALLET
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="card-black p-3 rounded border-white">
                    <div className="flex items-center gap-3">
                      <User className="text-white" size={20} />
                      <div>
                        <div className="text-xs text-very-dark-gray typewriter-label">
                          {connectionSource === 'electron' ? 'CONNECTED (ELECTRON)' : 'CONNECTED'}
                        </div>
                        <div className="typewriter-mono text-xs text-white">
                          {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                        </div>
                        <div className="text-xs typewriter-body text-light-gray">
                          {connectionSource === 'electron' ? 'OFFLINE MODE' : `${balance} STRK`}
                        </div>
                      </div>
                      <button
                        onClick={disconnectWallet}
                        className="text-gray hover:text-white transition-colors"
                        title="Disconnect"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4">
          {statusMessage && (
            <div className="mb-6 p-4 bg-darker-black border border-white text-white rounded typewriter-body">
              {statusMessage}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Offline Account Management */}
            <div className="card-black rounded p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white typewriter-title">
                <Key size={24} />
                OFFLINE.ACCOUNT
              </h2>
              
              {!offlineAccountId ? (
                <div className="space-y-3">
                  <button
                    onClick={generateLocalAccount}
                    disabled={isLoading || !wallet}
                    className="w-full btn-white px-4 py-3 rounded typewriter-body"
                  >
                    {isLoading ? 'GENERATING...' : 'GENERATE.NEW.ACCOUNT'}
                  </button>
                  
                  <button
                    onClick={loadExistingOfflineAccount}
                    disabled={isLoading}
                    className="w-full btn-black px-4 py-3 rounded typewriter-body"
                  >
                    LOAD.EXISTING.ACCOUNT
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-very-dark-gray mb-2 typewriter-label">ACCOUNT.ID:</p>
                  <p className="typewriter-mono text-xs bg-darkest-black p-2 rounded mb-2 break-all text-white border border-dark-gray">
                    {offlineAccountId}
                  </p>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm text-dark-gray typewriter-label">
                        BALANCE: <span className="font-semibold text-white text-lg">{offlineBalance}</span>
                      </p>
                      <p className="text-sm text-dark-gray typewriter-label">
                        NONCE: <span className="font-semibold text-white text-lg">{offlineNonce}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => refreshOfflineAccountData()}
                      disabled={isRefreshingBalance}
                      className="btn-black p-2 rounded"
                    >
                      {isRefreshingBalance ? (
                        <RefreshCw className="animate-spin" size={20} />
                      ) : (
                        <RefreshCw size={20} />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => setShowKeysModal(true)}
                    className="w-full bg-darkest-black text-light-gray px-4 py-2 rounded border border-dark-gray hover:border-white transition-all typewriter-body text-sm"
                  >
                    <Settings size={16} className="inline mr-2" />
                    ADVANCED.CONFIG
                  </button>
                </div>
              )}
            </div>

            {/* Funds Management */}
            {offlineAccountId && (
              <div className="card-black rounded p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white typewriter-title">
                  <PlusCircle size={24} />
                  FUNDS.MANAGEMENT
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-dark-gray mb-2 typewriter-label">DEPOSIT.STRK</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="Amount"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 input-typewriter rounded px-3 py-2"
                      />
                      <button
                        onClick={depositToOfflineAccount}
                        disabled={isLoading || !wallet}
                        className="btn-white px-4 py-2 rounded typewriter-body"
                      >
                        DEPOSIT
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-dark-gray mb-2 typewriter-label">WITHDRAW.STRK</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="Amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="flex-1 input-typewriter rounded px-3 py-2"
                      />
                      <button
                        onClick={withdrawFromOfflineAccount}
                        disabled={isLoading || !wallet}
                        className="btn-black px-4 py-2 rounded typewriter-body"
                      >
                        WITHDRAW
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Offline Signing - Full Width Section */}
          {offlineAccountId && localPrivKey && (
            <div className="mt-6">
              <div className="max-w-4xl mx-auto">
                <div className="card-black rounded p-8">
                  <h2 className="text-3xl font-semibold mb-8 flex items-center justify-center gap-3 text-white typewriter-title">
                    <Send size={32} />
                    OFFLINE.SIGNING
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-lg text-dark-gray mb-3 typewriter-label">RECIPIENT</label>
                        <input
                          type="text"
                          placeholder="0x..."
                          value={offlineRecipient}
                          onChange={(e) => setOfflineRecipient(e.target.value)}
                          className="w-full input-typewriter rounded px-4 py-3 text-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-lg text-dark-gray mb-3 typewriter-label">AMOUNT.STRK</label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="0.1"
                          value={offlineAmount}
                          onChange={(e) => setOfflineAmount(e.target.value)}
                          className="w-full input-typewriter rounded px-4 py-3 text-lg"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-center">
                      <button
                        onClick={signTransactionOffline}
                        disabled={isLoading}
                        className="w-full btn-white px-8 py-4 rounded typewriter-body text-xl"
                      >
                        {isLoading ? 'SIGNING...' : 'SIGN.TRANSACTION'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Offline Transaction Queue */}
          {offlineTransactionQueue.length > 0 && (
            <div className="mt-6">
              <div className="max-w-4xl mx-auto">
                <div className="card-black rounded p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-semibold flex items-center gap-3 text-white typewriter-title">
                      <Clock size={28} />
                      SIGNED.TRANSACTIONS [{offlineTransactionQueue.length}]
                    </h2>
                    
                    {/* BUTTON TO PROCESS TRANSACTIONS */}
                    <button
                      onClick={processTransactionQueue}
                      disabled={isLoading || !isOnline || !wallet}
                      className="btn-white px-6 py-3 rounded flex items-center gap-3 typewriter-body text-lg glow-effect"
                    >
                      <RefreshCw size={24} className={isLoading ? 'animate-spin' : ''} />
                      {isLoading ? 'PROCESSING...' : 'UPLOAD.TRANSACTIONS'}
                    </button>
                  </div>

                  {/* STATUS INDICATORS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-darkest-black p-4 rounded border border-dark-gray">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white typewriter-title">
                          {offlineTransactionQueue.length}
                        </p>
                        <p className="text-sm text-dark-gray typewriter-label">PENDING.TXS</p>
                      </div>
                    </div>
                    
                    <div className="bg-darkest-black p-4 rounded border border-dark-gray">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white typewriter-title">
                          {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </p>
                        <p className="text-sm text-dark-gray typewriter-label">CONNECTION</p>
                      </div>
                    </div>
                    
                    <div className="bg-darkest-black p-4 rounded border border-dark-gray">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white typewriter-title">
                          {wallet ? 'READY' : 'NO.WALLET'}
                        </p>
                        <p className="text-sm text-dark-gray typewriter-label">WALLET.STATUS</p>
                      </div>
                    </div>
                  </div>

                  {/* TRANSACTION LIST */}
                  <div className="space-y-3">
                    {offlineTransactionQueue.map((tx, index) => (
                      <div key={tx.id} className="bg-darkest-black p-4 rounded border border-dark-gray hover:border-white transition-all">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white typewriter-title">#{index + 1}</span>
                              </div>
                              <div>
                                <p className="text-lg text-white typewriter-body font-semibold">
                                  TRANSFER: {(BigInt(tx.amount) / BigInt(1e18)).toString()} STRK
                                </p>
                                <p className="text-sm text-dark-gray typewriter-mono">
                                  TO: {tx.to.substring(0, 20)}...{tx.to.substring(tx.to.length - 6)}
                                </p>
                                <p className="text-xs text-dark-gray typewriter-body">
                                  NONCE: {tx.nonce} | POSEIDON.HASH | TIMESTAMP: {new Date(tx.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <CheckCircle className="text-white mx-auto mb-1" size={24} />
                              <span className="text-xs text-white typewriter-label block">SIGNED</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* WARNING MESSAGE */}
                  {(!isOnline || !wallet) && (
                    <div className="mt-6 bg-darker-black border border-white rounded p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="text-white" size={24} />
                        <div>
                          <p className="text-white text-lg typewriter-body font-semibold">
                            CANNOT UPLOAD TRANSACTIONS
                          </p>
                          <p className="text-dark-gray text-sm typewriter-body">
                            {!isOnline && 'NO INTERNET CONNECTION. '}
                            {!wallet && 'WALLET NOT CONNECTED. '}
                            RESOLVE THESE ISSUES TO UPLOAD YOUR SIGNED TRANSACTIONS.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Keys Modal */}
          {showKeysModal && (
            <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
              <div className="bg-black border-2 border-white rounded p-8 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold mb-6 text-white typewriter-title">ADVANCED.CONFIG</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-dark-gray mb-3 typewriter-label">ACCOUNT.ID</label>
                    <div className="bg-darkest-black p-4 rounded border border-dark-gray">
                      <p className="typewriter-mono text-sm break-all text-white">{offlineAccountId}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-dark-gray mb-3 typewriter-label">PUBLIC.KEY</label>
                    <div className="bg-darkest-black p-4 rounded border border-dark-gray">
                      <p className="typewriter-mono text-sm break-all text-white">{localPublicKey}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm text-dark-gray typewriter-label">PRIVATE.KEY</label>
                      <button
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="text-white hover:text-gray transition-colors"
                      >
                        {showPrivateKey ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <div className="bg-darkest-black p-4 rounded border border-dark-gray">
                      <p className="typewriter-mono text-sm break-all text-white">
                        {showPrivateKey ? localPrivKey : '•'.repeat(66)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-darker-black border border-white rounded p-4">
                    <p className="text-white text-sm typewriter-body">
                      ⚠ WARNING: SAVE.THESE.KEYS.SECURELY. 
                      WITHOUT.THEM.YOU.CANNOT.ACCESS.YOUR.OFFLINE.ACCOUNT.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setShowKeysModal(false)}
                    className="flex-1 btn-white px-6 py-3 rounded typewriter-body"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Custom Wallet Connection Modal */}
          {showWalletModal && (
            <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
              <div className="bg-black border-2 border-white rounded p-8 max-w-lg w-full max-h-80vh overflow-y-auto">
                <h3 className="text-2xl font-bold mb-6 text-white typewriter-title text-center">CONNECT.WALLET</h3>
                
                <div className="space-y-4">
                  <button
                    onClick={() => handleWalletConnection('argentX')}
                    disabled={isLoading}
                    className="w-full btn-white px-6 py-4 rounded typewriter-body text-left flex items-center gap-4"
                  >
                    <div className="w-8 h-8 bg-white rounded border border-black flex items-center justify-center">
                      <span className="text-black font-bold text-xs">A</span>
                    </div>
                    <div>
                      <div className="font-semibold">ARGENT.X</div>
                      <div className="text-sm opacity-75">SMART.WALLET.FOR.STARKNET</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleWalletConnection('braavos')}
                    disabled={isLoading}
                    className="w-full btn-white px-6 py-4 rounded typewriter-body text-left flex items-center gap-4"
                  >
                    <div className="w-8 h-8 bg-white rounded border border-black flex items-center justify-center">
                      <span className="text-black font-bold text-xs">B</span>
                    </div>
                    <div>
                      <div className="font-semibold">BRAAVOS</div>
                      <div className="text-sm opacity-75">SMART.WALLET.FOR.STARKNET</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleWalletConnection()}
                    disabled={isLoading}
                    className="w-full btn-black px-6 py-4 rounded typewriter-body text-left flex items-center gap-4"
                  >
                    <div className="w-8 h-8 bg-white rounded border border-white flex items-center justify-center">
                      <Wallet className="text-black" size={16} />
                    </div>
                    <div>
                      <div className="font-semibold">DETECT.AVAILABLE.WALLETS</div>
                      <div className="text-sm opacity-75">SHOW.ALL.INSTALLED.WALLETS</div>
                    </div>
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-dark-gray">
                  <p className="text-dark-gray text-sm typewriter-body text-center mb-4">
                    MAKE.SURE.YOUR.WALLET.IS.INSTALLED.AND.UNLOCKED
                  </p>
                  <div className="text-xs text-very-dark-gray typewriter-mono text-center mb-4">
                    <p>NO.WALLET.DETECTED? INSTALL:</p>
                    <p>• ARGENT.X: chrome-extension://dlcobpjiigpikoobohmabehhmhfoodbb</p>
                    <p>• BRAAVOS: chrome-extension://jnlgamecbpmbajjfhmmmlhejkemejdma</p>
                  </div>
                  <button
                    onClick={() => setShowWalletModal(false)}
                    className="w-full btn-black px-6 py-3 rounded typewriter-body"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default OfflineTransferApp;
