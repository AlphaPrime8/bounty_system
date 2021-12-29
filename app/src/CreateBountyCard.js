import React, {useState} from 'react';

const CreateBountyCard = ({ proposeWithdraw }) => {

   const [inputAmount, setInputAmount] = useState('');
   const [inputReceiver, setInputReceiver] = useState('');

   function proposeCallback(){
      // get input values
      proposeWithdraw(parseFloat(inputAmount), inputReceiver);
   }

   return (
      <div className='stake-card'>
         <div className='stake-card-header'>
            <h2 className='ff-sans bold letter-spacing-3'>Create Bounty</h2>
         </div>
         <div className='stake-card-content'>
            <div className='stake-card-content-section flex'>

               <div className='stake-card-NFT flex flex-col'>
                  <form className='stake-card-NFT-form flex flex-col'>
                     <label>Criteria</label>
                     <input value={inputReceiver} onInput={e => setInputReceiver(e.target.value)} type='text' />
                  </form>
               </div>

               <div className='stake-card-amount flex flex-col'>
                  <form className='stake-card-amount-form flex flex-col'>
                     <label>Hunter</label>
                     <input value={inputAmount} onInput={e => setInputAmount(e.target.value)} type='text' />
                  </form>
               </div>

               <div className='stake-card-amount flex flex-col'>
                  <form className='stake-card-amount-form flex flex-col'>
                     <label>Amount</label>
                     <input value={inputAmount} onInput={e => setInputAmount(e.target.value)} type='text' />
                  </form>
               </div>


            </div>
            <div className='stake-card-content-button'>
               <button onClick={proposeCallback} className='stake-button ff-sans'>
                  Create
               </button>
            </div>
         </div>
      </div>
   );
};

export default CreateBountyCard;
