import React from 'react';
import Header from './Header';
import ConnectWalletButton from './ConnectWallet';

import CreateBountyCard from "./CreateBountyCard";
import BountyTableCard from "./BountyTableCard";

import * as anchor from '@project-serum/anchor';
import './App.css';
import { useState } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Provider, web3 } from '@project-serum/anchor';
import idl from './idl.json';
import { getPhantomWallet } from '@solana/wallet-adapter-wallets';
import {WalletProvider, ConnectionProvider} from '@solana/wallet-adapter-react';
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import {EXPECTED_CREATOR, VAULT_PDA_SEED, PEACH_EARNED_PER_SECOND, SECONDS_PER_DAY, USER_PDA_SEED, AUTH_PDA_SEED, WSOL_POOL_SEED, DEFAULT_MULTISIG_STATE, TBO_MINT, MAX_CRITERIA_LEN} from "./Config";
import {ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, Token} from "@solana/spl-token";
import {TOKEN_PROGRAM_ID} from "@project-serum/serum/lib/token-instructions";
import {to_lamports, to_sol} from "./utils";


require('@solana/wallet-adapter-react-ui/styles.css');
const metaplex = require('@metaplex/js');
const spl_token = require('@solana/spl-token');

// setup
const wallets = [getPhantomWallet()];
const network = clusterApiUrl('mainnet-beta');
// const network = "http://127.0.0.1:8899";
// const network = clusterApiUrl('devnet');
const { SystemProgram } = web3;
const opts = {preflightCommitment: 'processed'};
const programID = new PublicKey(idl.metadata.address);
// const programID = new PublicKey("EFyiucgJ2bHU9kHrvkbMvsy6UZ6pnMKZXV7H2bUmciko");

// TODO remove this shit
let userAccountPda; //TODO should this be a state or a global like this? also... we only need to look it up once

function App() {

   // TODO purge this shit too
   const [checkedIfUserAccountExists, setCheckedIfUserAccountExists] = useState(false);
   const [userAccountExists, setUserAccountExists] = useState(false);
   const [stakableImageUrls, setStakableImageUrls] = useState([]);
   const [unstakableImageUrls, setUnstakableImageUrls] = useState([]);
   const [stakablePubkeys, setStakablePubkeys] = useState([]);
   const [unstakablePubkeys, setUnstakablePubkeys] = useState([]);
   const [idxToStake, setIdxToStake] = useState(null);
   const [idxToUnstake, setIdxToUnstake] = useState(null);
   const [numNftsStaked, setNumNftsStaked] = useState(0);
   const [totalPeachEarned, setTotalPeachEarned] = useState(0);
   const [totalNumStaked, setTotalNumStaked] = useState(0);

   const [isLoading, setIsLoading] = useState(false);

   const [multisigState, setMultisigState] = useState([]);
   const [signersHaveApproved, setSignersHaveApproved] = useState(false);

   // Firefox 1.0+
   const isFirefox = typeof InstallTrigger !== 'undefined';
   if (!isFirefox){
      alert("Please use firefox.")
   }

   async function loadMultisigState() {
      setIsLoading(true);
      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);
      const [authPda] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(AUTH_PDA_SEED))],
          program.programId
      );
      const [poolWrappedSol] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(WSOL_POOL_SEED))],
          program.programId
      );

      console.log("Got dao treasury addy: ", poolWrappedSol.toBuffer());
      let authPdaInfo = await program.account.multisigAccount.fetch(authPda);

      console.log(authPdaInfo);

      let ms = [];
      for (let i=0; i<authPdaInfo.bounties.length; i++){
         let b = authPdaInfo.bounties[i];
         ms.push({
            acceptor: b.acceptor.toString(),
            hunter: b.hunter.toString(),
            criteria: b.criteria,
            amount: to_sol(b.amount.toNumber()),
         });
      }

      setMultisigState(ms)

      setIsLoading(false);
   }

   async function proposeWithdraw(criteria, proposed_amount, proposed_receiver) {

      if (criteria.length > MAX_CRITERIA_LEN){
         alert("Criter must be less than 30 characters");
         return;
      }

      console.log("calling proposeWithdraw with :", proposed_amount, proposed_receiver);
      setIsLoading(true);
      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);
      const [authPda] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(AUTH_PDA_SEED))],
          program.programId
      );
      const [poolTbo] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(WSOL_POOL_SEED))],
          program.programId
      );
      proposed_receiver = new PublicKey(proposed_receiver);

      await program.rpc.createBounty(
          criteria,
          proposed_receiver,
          new anchor.BN(to_lamports(proposed_amount)),
          {
             accounts: {
                signer: provider.wallet.publicKey,
                authPda: authPda,
                poolTbo: poolTbo,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
             },
          }
      );




      await loadMultisigState();
   }

   async function cancelBounty(index) {

      console.log("cancel index", index);

      setIsLoading(true);

      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);
      const [authPda] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(AUTH_PDA_SEED))],
          program.programId
      );

      await program.rpc.cancelBounty(
          new anchor.BN(index),
          {
             accounts: {
                signer: provider.wallet.publicKey,
                authPda: authPda,
                systemProgram: SystemProgram.programId,
             },
          }
      );

      // check balance
      await loadMultisigState();
   }

   async function approveWithdraw(index) {

      console.log("approve index", index);

      setIsLoading(true);

      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);
      const [authPda] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(AUTH_PDA_SEED))],
          program.programId
      );
      const [poolTbo] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(WSOL_POOL_SEED))],
          program.programId
      );

      // load hunter
      const hunter = multisigState[index].hunter;

      // load mint
      const connection = new Connection(network);
      let mint_addy = new PublicKey(TBO_MINT);
      let tboMint = new Token(connection, mint_addy, TOKEN_PROGRAM_ID, provider.wallet);
      let hunter_pk = new PublicKey(hunter);

      console.log("initialized tboMint: ", tboMint);
      console.log("pubkey of mint? ", tboMint.publicKey.toString());
      console.log("using hunter pk: ",  hunter_pk.toString());

      // check balance
      let receiverAta = await tboMint.getOrCreateAssociatedAccountInfo(hunter_pk);
      console.log("got hunter ata: ", receiverAta.address)
      console.log("got amount before: ", receiverAta.amount.toNumber());

      // get or create token account for give pubkey owner3

      await program.rpc.awardBounty(
          new anchor.BN(index),
          {
             accounts: {
                signer: provider.wallet.publicKey,
                authPda: authPda,
                poolTbo: poolTbo,
                proposedReceiver: receiverAta.address,
                tboMint: tboMint.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
             },
          }
      );

      // check balance
      receiverAta = await tboMint.getOrCreateAssociatedAccountInfo(hunter_pk);
      console.log("got amount after: ", receiverAta.amount.toNumber());
      await loadMultisigState();
   }

   async function executeWithdraw() {
      setIsLoading(true);
      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);
      const [authPda] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(AUTH_PDA_SEED))],
          program.programId
      );
      const [poolWrappedSol] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(WSOL_POOL_SEED))],
          program.programId
      );

      await program.rpc.executeWithdraw(
          {
             accounts: {
                signer: provider.wallet.publicKey,
                authPda: authPda,
                poolWrappedSol: poolWrappedSol,
                proposedReceiver: new PublicKey(multisigState.proposed_receiver),
                wsolMint: NATIVE_MINT,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
             },
          }
      );

      await loadMultisigState();
   }

   async function getTotalNumStaked() {
      // all staked NFTs are transferred to the same VAULT PDA, ie an account owned by the staking contract.
      // so to see the total staked, we just look at this account and see how many token accounts it owns.
      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);
      const connection = new Connection(network);
      const [vaultPda] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode(VAULT_PDA_SEED))],
          program.programId
      );
      let accounts = await connection.getTokenAccountsByOwner(vaultPda, { programId: spl_token.TOKEN_PROGRAM_ID });
      const total_num_staked = accounts.value.length;
      setTotalNumStaked(total_num_staked);
      console.log("Got total num staked: %s for VAULT PDA wit Pubkey: %s", total_num_staked, vaultPda.toString());
   }

   async function getStakableNfts() {
      // load phantom wallet
      const connection = new Connection(network);
      const adapter = wallets[0].adapter();
      await adapter.connect();

      // load token accounts
      let accounts = await connection.getTokenAccountsByOwner(
         adapter.publicKey,
         { programId: spl_token.TOKEN_PROGRAM_ID }
      );
      let stakable_image_urls = [];
      let stakable_pubkeys = [];
      for (const aidx in accounts.value) {
         try {
            // load metaplex metadata (this will error if its not a metaplex NFT account)
            const act = accounts.value[aidx];
            let acctInfo = act.account;

            // TODO move to function
            let acctInfoDecoded = spl_token.AccountLayout.decode(Buffer.from(acctInfo.data));
            let mint = new PublicKey(acctInfoDecoded.mint);
            const pda = await metaplex.programs.metadata.Metadata.getPDA(mint.toString());
            const metadata = await metaplex.programs.metadata.Metadata.load(connection, pda);
            let uri = metadata.data.data.uri;

            // confirm creators
            let creators = metadata.data.data.creators;
            let onchain_addresses = [];
            for (const key in creators) {
               onchain_addresses.push(creators[key].address);
            }

            if (onchain_addresses.includes(EXPECTED_CREATOR)) {
               // continue to display
               let arweaveData = await (await fetch(uri)).json();
               creators = arweaveData.properties.creators;
               const image_url = arweaveData.image;
               stakable_image_urls.push(image_url);
               console.log(
                  'Found NFT with account pubkey: %s and image url: %s',
                  act.pubkey.toString(),
                  image_url
               );
               stakable_pubkeys.push(act.pubkey);
               console.log('called setStakeableNftAccountPubkey with: ');
            }
         } catch (err) {
            console.log(err);
         }
      }
      console.log("called setStakableImageUrls() with ", stakable_image_urls);
      setStakableImageUrls(stakable_image_urls);
      setStakablePubkeys(stakable_pubkeys);
   }

   async function getUnstakableNfts() {
      // lookup and deserialize stake account
      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);
      const connection = new Connection(network);

      try {
         // this call get a PDA (program derived address, which is a data account owned by the NFT Staking contract)
         [userAccountPda] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from(USER_PDA_SEED), provider.wallet.publicKey.toBuffer()],
            program.programId
         );

         // this call loads the data from the PDA and deserializes it according to schema provided in the IDL
         const _userAccountPda = await program.account.userAccount.fetch(
            userAccountPda
         );
         console.log(_userAccountPda);

         //NOTE: To calculate earned peach, we must multiply total time staked for all NFTs by PEACH_EARNED_PER_SECOND
         // but the field cumulativeSecondsStaked is only updated upon unstake event. So for current staked NFTs, we must
         // use the difference between current timestamp and stakeTimestamp. This value should be updated in real time in
         // the UI, so user can see the number going up. I.e. if two NFTs are staked then every second they will see their
         // earned PEACH increase by (PEACH_EARNED_PER_SECOND * 2)
         // unpack staked NFT data
         let total_seconds_staked = 0;
         let unstakable_image_urls = [];
         let unstakable_pubkeys = [];
         for (const i in _userAccountPda.nftStakeRecords) {
            const nft_record = _userAccountPda.nftStakeRecords[i];
            console.log(nft_record);
            const is_staked = nft_record.isStaked;
            const nft_account = nft_record.nftAccount;
            const stake_timestamp = nft_record.stakeTimestamp.toNumber();
            const cumulative_seconds_staked =
               nft_record.cumulativeSecondsStaked.toNumber();
            console.log(
               'account with Pubkey %s is staked: %s and has accumulated staking seconds: %s and stake timestamp: %s',
               nft_account.toString(),
               is_staked,
               cumulative_seconds_staked,
               stake_timestamp
            );

            total_seconds_staked += cumulative_seconds_staked;

            if (is_staked) {
               total_seconds_staked += (Date.now() / 1000) - stake_timestamp;
               unstakable_pubkeys.push(nft_account);
               // lookup arweave url from nft_account pubkey
               let acctInfo = await connection.getAccountInfo(nft_account);

               //TODO move to function
               let acctInfoDecoded = spl_token.AccountLayout.decode(Buffer.from(acctInfo.data));
               let mint = new PublicKey(acctInfoDecoded.mint);
               const pda = await metaplex.programs.metadata.Metadata.getPDA(mint.toString());
               const metadata = await metaplex.programs.metadata.Metadata.load(connection, pda);
               let uri = metadata.data.data.uri;

               let arweaveData = await (await fetch(uri)).json();
               const image_url = arweaveData.image;
               unstakable_image_urls.push(image_url);
               console.log('***got image url for staked nft: %s', image_url);
            }
         }

         const peach_earned = total_seconds_staked * PEACH_EARNED_PER_SECOND;

         setNumNftsStaked(unstakable_image_urls.length)
         setUnstakablePubkeys(unstakable_pubkeys);
         setUnstakableImageUrls(unstakable_image_urls);
         setTotalPeachEarned(peach_earned);

         console.log('Current unix time is: %s', Date.now() / 1000);
         console.log('Total hours staked: %s', total_seconds_staked / 3600);
         console.log('TOTAL PEACH EARNED: %s', peach_earned);

      } catch (err) {
         console.error(err);
      }
   }

   async function loadNftInfo() {
      setIsLoading(true);
      await getStakableNfts();
      await getUnstakableNfts();
      await getTotalNumStaked();
      setIsLoading(false);
   }

   async function getUserAccount() {
      setIsLoading(true);
      // lookup and deserialize stake account
      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);

      try {
         // this call get a PDA (program derived address, which is a data account owned by the NFT Staking contract)
         [userAccountPda] = await anchor.web3.PublicKey.findProgramAddress(
             [Buffer.from(USER_PDA_SEED), provider.wallet.publicKey.toBuffer()],
            program.programId
         );
         const _userAccountPda = await program.account.userAccount.fetch(userAccountPda);
         setCheckedIfUserAccountExists(true);
         setUserAccountExists(true);

         await loadNftInfo();
      } catch (e) {
         console.log(e);
         setCheckedIfUserAccountExists(true);
         setUserAccountExists(false);
      }
      setIsLoading(false);
   }

   async function initializeUserAccount() {
      setIsLoading(true);
      const provider = await getProvider();
      const program = new anchor.Program(idl, programID, provider);

      //TODO we might not need to lookup the pdas multiple times... only re-fetch for info.
      [userAccountPda] = await anchor.web3.PublicKey.findProgramAddress(
          [Buffer.from(USER_PDA_SEED), provider.wallet.publicKey.toBuffer()],
         program.programId
      );

      await program.rpc.initUserAccount({
         accounts: {
            staker: provider.wallet.publicKey,
            userAccountPda: userAccountPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: spl_token.TOKEN_PROGRAM_ID,
         },
      });

      // lookup and deserialize stake account
      console.log('created user account');
      setUserAccountExists(true);

      await loadNftInfo();
      setIsLoading(false);
   }

   async function stakeNft() {
      setIsLoading(true);
      console.log('stake');
      try {
         const provider = await getProvider();
         const program = new anchor.Program(idl, programID, provider);
         await program.rpc.stakeNft({
            accounts: {
               staker: provider.wallet.publicKey,
               nftAccount: stakablePubkeys[idxToStake],
               userAccountPda: userAccountPda,
               systemProgram: SystemProgram.programId,
               tokenProgram: spl_token.TOKEN_PROGRAM_ID,
            },
         });

         console.log("staked nft, now reloading info")
         await  onStakeSuccess();

      } catch (err) {
         console.error(err);
      }
      setIsLoading(false);
   }

   async function unstakeNft() {
      setIsLoading(true);
      console.log('unstake');
      try {
         const provider = await getProvider();
         const program = new anchor.Program(idl, programID, provider);
         // Get the PDA that is assigned authority to token account.
         const [vaultPda] = await PublicKey.findProgramAddress(
            [Buffer.from(anchor.utils.bytes.utf8.encode(VAULT_PDA_SEED))],
            program.programId
         );

         await program.rpc.unstakeNft({
            accounts: {
               staker: provider.wallet.publicKey,
               nftAccount: unstakablePubkeys[idxToUnstake],
               userAccountPda: userAccountPda,
               vaultPda: vaultPda,
               tokenProgram: spl_token.TOKEN_PROGRAM_ID,
            },
         });
         console.log("staked nft, now reloading info")
         await  onUnstakeSuccess();
      } catch (err) {
         console.error(err);
      }
      setIsLoading(false);
   }

   async function onStakeSuccess(){

      // make copies
      let s_pubkeys = stakablePubkeys.slice();
      let s_urls = stakableImageUrls.slice();
      let u_pubkeys = unstakablePubkeys.slice();
      let u_urls = unstakableImageUrls.slice();

      // get items to move
      const pk = stakablePubkeys[idxToStake];
      const url = stakableImageUrls[idxToStake];

      // remove from stakable
      s_pubkeys.splice(idxToStake, 1);
      s_urls.splice(idxToStake, 1);

      // add to unstakable
      u_pubkeys.push(pk);
      u_urls.push(url);

      // set new state
      setStakablePubkeys(s_pubkeys);
      setStakableImageUrls(s_urls);
      setUnstakablePubkeys(u_pubkeys);
      setUnstakableImageUrls(u_urls);

      setNumNftsStaked(numNftsStaked+1);
      setTotalNumStaked(totalNumStaked+1);
      setIdxToStake(null);
      setIdxToUnstake(null);
   }

   async function onUnstakeSuccess(){
      // make copies
      let s_pubkeys = stakablePubkeys.slice();
      let s_urls = stakableImageUrls.slice();
      let u_pubkeys = unstakablePubkeys.slice();
      let u_urls = unstakableImageUrls.slice();

      // get items to move
      const pk = unstakablePubkeys[idxToUnstake];
      const url = unstakableImageUrls[idxToUnstake];

      // remove from stakable
      u_pubkeys.splice(idxToUnstake, 1);
      u_urls.splice(idxToUnstake, 1);

      // add to unstakable
      s_pubkeys.push(pk);
      s_urls.push(url);

      // set new state
      setStakablePubkeys(s_pubkeys);
      setStakableImageUrls(s_urls);
      setUnstakablePubkeys(u_pubkeys);
      setUnstakableImageUrls(u_urls);

      setNumNftsStaked(numNftsStaked-1);
      setTotalNumStaked(totalNumStaked-1);
      setIdxToStake(null);
      setIdxToUnstake(null);
   }

   async function getProvider() {

      const connection = new Connection(network, opts.preflightCommitment);
      const wallet = wallets[0].adapter();
      await wallet.connect();

      console.log("getting provider with local wallet PK: %s", wallet.publicKey.toString());

      const provider = new Provider(
         connection,
         wallet,
         opts.preflightCommitment
      );
      return provider;
   }

   return (
      <ConnectionProvider endpoint={network}>
         <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
               <div className='App'>
                  <div className='main'>
                     <Header />

                     <ConnectWalletButton
                         loadMultisigState={loadMultisigState}
                         isLoading={isLoading}
                     />

                     <div className='container flex-container'>
                        <BountyTableCard
                            approveWithdraw={approveWithdraw}
                            cancelBounty={cancelBounty}
                            multisigState={multisigState}
                        />
                     </div>

                     <div className='container flex-container'>
                        <CreateBountyCard proposeWithdraw={proposeWithdraw} />
                     </div>


                  </div>
               </div>
            </WalletModalProvider>
         </WalletProvider>
      </ConnectionProvider>
   );
}

export default App;
