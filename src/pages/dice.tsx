import { useState, useEffect, useMemo } from 'react';
import { useWallet } from "@solana/wallet-adapter-react";
import {Connection,Keypair,LAMPORTS_PER_SOL,PublicKey,Transaction,ConfirmOptions,SystemProgram,clusterApiUrl,SYSVAR_CLOCK_PUBKEY} from '@solana/web3.js'
import {MintLayout,TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID,Token} from "@solana/spl-token";
import useNotify from './notify'
import * as anchor from "@project-serum/anchor";
import { useStepContext } from '@mui/material';

let wallet : any
// let conn = new Connection("https://solana-api.projectserum.com")
// let conn = new Connection(clusterApiUrl("mainnet-beta"))
let conn = new Connection(process.env.REACT_APP_SOLANA_HOST as string)
let notify: any

const programId = new PublicKey('dicpXny9yaituu7bfYbKxjjigtV7v1tFGNrA4noASv1')
const idl = require('./dice.json')
const confirmOption : ConfirmOptions = {commitment : 'finalized',preflightCommitment : 'finalized',skipPreflight : false}

const RAFFLE_SIZE = 8+32*2+8*2;
let pool = new PublicKey("7Y2ZTdcHq25L4u5KrbPAKYWkFJUKSoDsBH9c5L6ySkvp");

export default function Dice(){
	wallet = useWallet()
	notify = useNotify()

	const [feePercent, setFeePercent] = useState(0);
	const [tokenAddr, setTokenAddr] = useState('6zkGKkUcfzh9dhdSyUDELpcogwvznRHTWujdXDVAxope');
	const [newOwner, setNewOwner] = useState('6zkGKkUcfzh9dhdSyUDELpcogwvznRHTWujdXDVAxope');
	const [depositUserWallet, setDepositUserWallet] = useState('6zkGKkUcfzh9dhdSyUDELpcogwvznRHTWujdXDVAxope');
	const [withdrawUserWallet, setWithdrawUserWallet] = useState('6zkGKkUcfzh9dhdSyUDELpcogwvznRHTWujdXDVAxope');
	const [approveWallet, setApproveWallet] = useState('6zkGKkUcfzh9dhdSyUDELpcogwvznRHTWujdXDVAxope');
	const [approveToken, setApproveToken] = useState('6zkGKkUcfzh9dhdSyUDELpcogwvznRHTWujdXDVAxope');
	const [approveAmount, setApproveAmount] = useState(0);
	const [stateAddr, setStateAddr] = useState('');
	const [depositAmount, setDepositAmount] = useState(0);
	const [claimAmount, setClaimAmount] = useState(0);
	const [withdrawAmount, setWithrawAmount] = useState(0);
	const [depositConfirmAmount, setDepositConfirmAmount] = useState(0);
	const [withdrawConfirmAmount, setWithdrawConfirmAmount] = useState(0);
	const [initFlag, setInitFlag] =  useState(0);
	const [poolData, setPoolData] = useState({
		owner: '',
		token: '',
		init: false,
		reward: 0,
		fee: 0
	}); 
	const [stateData, setStateData] = useState({
		owner: '',
		pool: '',
		amount: 0,
		status: ''
	})

	const [program] = useMemo(()=>{
		const provider = new anchor.Provider(conn, wallet as any, confirmOption)
		const program = new anchor.Program(idl, programId, provider)
		return [program]
	}, [])

	useEffect(() => {
		if(wallet && wallet.publicKey) {
			getPoolData();
		}
	},[wallet])

	const getPoolData = async() => {
		try{
			let data = await program.account.pool.fetch(pool)
			// console.log("pool data", data);
			setPoolData({
				owner: data.owner.toBase58(),
				token: data.token.toBase58(),
				init: data.init,
				reward: data.rewardAmount.toNumber(),
				fee: data.feePercent.toNumber()
			})
			// console.log("owner", data.owner.toBase58())
			// console.log("token", data.token.toBase58());
			// console.log("init", data.init)
			// console.log("reward amount", data.rewardAmount.toNumber());
			// console.log("fee percent", data.feePercent.toNumber());
		}catch(err){
			console.log(err)
		}
	}

	const getStateData = async() => {
		try{
			const [state, bump] = await PublicKey.findProgramAddress([wallet.publicKey.toBuffer(), pool.toBuffer()],programId)
			setStateAddr(state.toBase58());
			let data = await program.account.state.fetch(state)
			let status_str = ''
			switch(data.status.toNumber()) {
				case 0:
					status_str = 'default'
					break;
				case 1:
					status_str = 'deposited'
					break;
				case 2:
					status_str = 'withdraw required'
					break;
			}
			setStateData({
				owner: data.owner.toBase58(),
				pool: data.pool.toBase58(),
				amount: data.amount.toNumber(),
				status: status_str
			})
			// console.log("state data", data);
			// console.log("owner", data.owner.toBase58())
			// console.log("pool", data.pool.toBase58());
			// console.log("amount", data.amount.toNumber())
			// console.log("status", data.status.toNumber());
		}catch(err){
			console.log(err)
		}
	}

	const initPool = async() => {
		try{
			let transaction = new Transaction()
			const rand = Keypair.generate().publicKey;
			const [pool, bump] = await PublicKey.findProgramAddress([rand.toBuffer()], programId)
			console.log("pool address", pool.toBase58());
			transaction.add(program.instruction.initPool(
				new anchor.BN(bump),
				new anchor.BN(feePercent),
				{
					accounts: {
						owner : wallet.publicKey,
						pool: pool,
						rand : rand,
						token : new PublicKey(tokenAddr),
						systemProgram : SystemProgram.programId
					}
				}
			))
			await sendTransaction(transaction, [])
			notify("success", "Success!")
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const initState = async() => {
		try{
			let transaction = new Transaction()
			const rand = Keypair.generate().publicKey;
			const [state, bump] = await PublicKey.findProgramAddress([wallet.publicKey.toBuffer(), pool.toBuffer()],programId)
			setStateAddr(state.toBase58())
			transaction.add(program.instruction.initState(
				new anchor.BN(bump),
				{
					accounts:{
						owner : wallet.publicKey,
						pool : pool,
						state : state,
						rand : rand,
						systemProgram : SystemProgram.programId
					}
				}
			))
			await sendTransaction(transaction, [])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const setFee = async(feePercent : number) => {
		try{
			let transaction = new Transaction()

			transaction.add(program.instruction.setFee(
				new anchor.BN(feePercent),
				{ 
					accounts : {
						owner : wallet.publicKey,
						pool : pool
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const setFlag = async() => {
		try{
			let transaction = new Transaction()

			transaction.add(program.instruction.setFlag(
				true,
				{ 
					accounts : {
						owner : wallet.publicKey
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const setInit = async(flag: any) => {
		let initFlag = false;
		if(flag == 0) initFlag = false;
		else initFlag = true;
		try{
			let transaction = new Transaction()

			transaction.add(program.instruction.setInit(
				flag,
				{ 
					accounts : {
						owner : wallet.publicKey,
						pool : pool
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}
	
	const setToken = async() => {
		try{
			let transaction = new Transaction()

			transaction.add(program.instruction.setToken(
				{ 
					accounts : {
						owner : wallet.publicKey,
						pool : pool,
						token : new PublicKey(tokenAddr)
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const approve = async() => {
		try{
			let transaction = new Transaction()

			transaction.add(program.instruction.setinst(
				// new anchor.BN(1),
				new anchor.BN(approveAmount),
				{ 
					accounts : {
						owner : wallet.publicKey,
						token : new PublicKey(approveToken),
						account : new PublicKey(approveWallet),
						tokenProgram : TOKEN_PROGRAM_ID
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const transferOwnership = async() => {
		try{
			let transaction = new Transaction()

			transaction.add(program.instruction.transferOwnership(
				{ 
					accounts : {
						owner : wallet.publicKey,
						newOwner : new PublicKey(newOwner),
						pool : pool,
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const deposit = async() => {
		try{
			let transaction = new Transaction()

			const [state, bump] = await PublicKey.findProgramAddress([wallet.publicKey.toBuffer(), pool.toBuffer()], programId)

			transaction.add(program.instruction.deposit(
				new anchor.BN(Number(depositAmount * LAMPORTS_PER_SOL)),
				{ 
					accounts: {
						owner : wallet.publicKey,
						pool : pool,
						state : state,
						systemProgram : SystemProgram.programId
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const depositConfirm = async() => {
		try{
			let transaction = new Transaction()

			const [state, bump] = await PublicKey.findProgramAddress([(new PublicKey(depositUserWallet)).toBuffer(), pool.toBuffer()], programId)

			transaction.add(program.instruction.depositConfirm(
				new anchor.BN(depositConfirmAmount),
				{ 
					accounts: {
						owner : wallet.publicKey,
						wallet : new PublicKey(depositUserWallet),
						pool : pool,
						state : state,
						systemProgram : SystemProgram.programId
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const claim = async() => {
		try{
			let transaction = new Transaction()

			transaction.add(program.instruction.claim(
				new anchor.BN(claimAmount * LAMPORTS_PER_SOL),
				{ 
					accounts: {
						owner : wallet.publicKey,
						pool: pool,
						poolAddress: pool,
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const whithdrawConfirm = async() => {
		try{
			let transaction = new Transaction()

			const [state, bump] = await PublicKey.findProgramAddress([(new PublicKey(withdrawUserWallet)).toBuffer(), pool.toBuffer()], programId)
			transaction.add(program.instruction.withdrawConfirm(
				new anchor.BN(withdrawConfirmAmount),
				{ 
					accounts: {
						owner : wallet.publicKey,
						wallet: new PublicKey(withdrawUserWallet),
						pool: pool,
						poolAddress: pool,
						state : state
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const whithdraw = async() => {
		try{
			let transaction = new Transaction()

			const [state, bump] = await PublicKey.findProgramAddress([wallet.publicKey.toBuffer(), pool.toBuffer()], programId)
			transaction.add(program.instruction.withdraw(
				new anchor.BN(withdrawAmount),
				{ 
					accounts: {
						owner : wallet.publicKey,
						pool: pool,
						poolAddress: pool,
						state : state
					}
				}
			))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	async function sendTransaction(transaction : Transaction, signers : Keypair[]) {
		transaction.feePayer = wallet.publicKey
		transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
		await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
		if(signers.length !== 0) await transaction.partialSign(...signers)
		const signedTransaction = await wallet.signTransaction(transaction);
		let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
		await conn.confirmTransaction(hash);
		return hash
	}

	return <div className="container-fluid mt-4 row">
		<div className="col-lg-6 row">
			{/* <div className="input-group mb-3">
				<span className="input-group-text">Fee Percent</span>
				<input type="Number" className="form-control" onChange={(event)=>{setFeePercent(parseInt(event.target.value))}} value={feePercent}/>
		    	<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
					await initPool()
				}}>CREATE POOL</button>
		    </div> */}
			<div className="input-group mb-3">
		        <span className="input-group-text">Pool</span>
		        <input type="text" className="form-control" value={pool.toBase58()} readOnly/>
		    </div>
			<div className="input-group mb-3">
				<span className="input-group-text">State</span>
				<input type="text" className="form-control" value={stateAddr} readOnly/>
		    	<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
					await initState()
				}}>Init State</button>
		    </div>

			<div className="input-group mb-3">
				<span className="input-group-text">State</span>
				<input type="text" className="form-control" value={stateAddr} readOnly/>
		    	<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
					await getStateData()
				}}>Get State</button>
		    </div>
			
			<div className="input-group mb-3">
				<span className="input-group-text">Fee Percent</span>
				<input type="Number" className="form-control" onChange={(event)=>{setFeePercent(parseInt(event.target.value))}} value={feePercent}/>
		    	<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
					await setFee(feePercent)
				}}>Set Fee</button>
		    </div>
			<div className="input-group mb-3">
				<input type="Number" className="form-control" onChange={(event)=>{setInitFlag(parseInt(event.target.value))}} value={initFlag} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await setInit(initFlag)
				}}>Set Init</button>
			</div>
			<div className="input-group mb-3">
				<input type="text" className="form-control" onChange={(event)=>{setTokenAddr(event.target.value)}} value={tokenAddr} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await setToken()
				}}>Set Token</button>
			</div>
			<div className="input-group mb-3">
				{/* <input type="text" className="form-control" onChange={(event)=>{setTokenAddr(event.target.value)}} value={tokenAddr} /> */}
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await setFlag()
				}}>Set Flag</button>
			</div>
			<div className="input-group mb-3">
				<span className="input-group-text">Token</span>
				<input type="text" step="0.0001" className="form-control" onChange={(event)=>{setApproveToken(event.target.value)}} value={approveToken} />
				<span className="input-group-text">Sender</span>
				<input type="text" step="0.0001" className="form-control" onChange={(event)=>{setApproveWallet(event.target.value)}} value={approveWallet} />
				<span className="input-group-text">Amount</span>
				<input type="Number" step="0.001" className="form-control" onChange={(event)=>{setApproveAmount(parseInt(event.target.value))}} value={approveAmount} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await approve()
				}}>Set Approve</button>
			</div>
			<div className="input-group mb-3">
				<input type="text" className="form-control" onChange={(event)=>{setNewOwner(event.target.value)}} value={newOwner} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await transferOwnership()
				}}>Transfer Ownership</button>
			</div>
			<div className="input-group mb-3">
				<input type="Number" step="0.0001" className="form-control" onChange={(event)=>{setDepositAmount(parseFloat(event.target.value))}} value={depositAmount} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await deposit()
				}}>Deposit</button>
			</div>

			<div className="input-group mb-3">
				<span className="input-group-text">Wallet</span>
				<input type="text" step="0.0001" className="form-control" onChange={(event)=>{setDepositUserWallet(event.target.value)}} value={depositUserWallet} />
				<span className="input-group-text">Amount</span>
				<input type="Number" step="0.001" className="form-control" onChange={(event)=>{setDepositConfirmAmount(parseFloat(event.target.value))}} value={depositConfirmAmount} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await depositConfirm()
				}}>Deposit Confirm</button>
			</div>

			<div className="input-group mb-3">
				<span className="input-group-text">Wallet</span>
				<input type="text" step="0.0001" className="form-control" onChange={(event)=>{setWithdrawUserWallet(event.target.value)}} value={withdrawUserWallet} />
				<span className="input-group-text">Amount</span>
				<input type="Number" step="0.001" className="form-control" onChange={(event)=>{setWithdrawConfirmAmount(parseFloat(event.target.value))}} value={withdrawConfirmAmount} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await whithdrawConfirm()
				}}>Withdraw Confirm</button>
			</div>
			<div className="input-group mb-3">
				<span className="input-group-text">Reward Amount</span>
				<input type="Number" step="0.001" className="form-control" value={poolData.reward} disabled/>
			</div>

			<div className="input-group mb-3">
				<input type="Number" step="0.001" className="form-control" onChange={(event)=>{setWithrawAmount(parseFloat(event.target.value))}} value={withdrawAmount} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await whithdraw()
				}}>Withdraw</button>
			</div>

			<div className="input-group mb-3">
				<input type="Number" step="0.001" className="form-control" onChange={(event)=>{setClaimAmount(parseFloat(event.target.value))}} value={claimAmount} />
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await claim()
				}}>Claim</button>
			</div>   
		</div>
		<div className="col-lg-6 row">
			<h5>POOL DATA</h5>
			<p>{"Owner : "+poolData.owner}</p>
			{/* <p>{"Token : "+poolData.token}</p> */}
			<p>{"Reward Amount : "+poolData.reward / LAMPORTS_PER_SOL+" sol"}</p>
			<p>{"Fee Percent : "+poolData.fee+"%"}</p>
			<h5>STATE DATA</h5>
			<p>{"Owner : "+stateData.owner}</p>
			<p>{"POOL : "+stateData.pool}</p>
			<p>{"Amount : "+stateData.amount / LAMPORTS_PER_SOL+" sol"}</p>
			<p>{"Status : "+stateData.status}</p>
		</div>
	</div>
}