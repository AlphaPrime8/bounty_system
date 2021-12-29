import React, {useMemo, useState, useEffect} from 'react';
import { Keypair } from "@solana/web3.js";

// sample data
let sample_bounties = [];
const ROHDEL_PUBKEY = "D4K5yZR1kcvaX7ZDTUWpGoZM8gHVjC1pxB1m1vSmC5NZ";
for (let i= 0; i < 10; i++){
    sample_bounties.push({
        criteria: "Vote on whether to pass tokenomics proposal.",
        hunter: Keypair.generate().publicKey.toString(),
        acceptor: ROHDEL_PUBKEY,
        amount: 3,
    })
}

function format_pk(pk){
    return pk.slice(0,5) + "..." + pk.slice(-4,pk.length);
}

const BountyTableCard = ({ approveWithdraw, multisigState }) => {

    return (
        <div className='stake-card'>
            <div className='stake-card-header'>
                <h2 className='ff-sans bold letter-spacing-3'>Open Bounties</h2>
            </div>

            <div className='stake-card-content'>

                <table>
                    <tr>
                        <th>Criteria</th>
                        <th>Hunter</th>
                        <th>Amount (#TBO)</th>
                        <th>Est. Amount ($)</th>
                        <th>Acceptor</th>
                        <th>Close</th>
                        <th>Cancel</th>
                    </tr>
                    {sample_bounties.map((bounty, i) => {
                        return (
                            <tr>
                                <td>{bounty.criteria}</td>
                                <td>{format_pk(bounty.hunter)}</td>
                                <td>{bounty.amount}</td>
                                <td>{bounty.amount * 6000}</td>
                                <td>{format_pk(bounty.acceptor)}</td>
                                <td><button>close</button></td>
                                <td><button>cancel</button></td>
                            </tr>
                        );
                    })}
                </table>
            </div>
        </div>
    );
};

export default BountyTableCard;
