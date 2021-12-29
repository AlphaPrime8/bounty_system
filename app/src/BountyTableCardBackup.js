import React, {useMemo, useState, useEffect} from 'react';
import { Keypair } from "@solana/web3.js";
import Table from "./Table";
import axios from "axios";

// sample data
let sample_bounties = [];
const ROHDEL_PUBKEY = "D4K5yZR1kcvaX7ZDTUWpGoZM8gHVjC1pxB1m1vSmC5NZ";
for (let i= 0; i < 10; i++){
    sample_bounties.push({
        criteria: "Vote on whether to pass tokenomics proposal.",
        hunter: Keypair.generate().publicKey.toBuffer(),
        acceptor: ROHDEL_PUBKEY,
        amount: 3,
    })
}

const BountyTableCard = ({ approveWithdraw, multisigState }) => {

    const columns = useMemo(
        () => [
            {
                // first group - TV Show
                Header: "TV Show",
                // First group columns
                columns: [
                    {
                        Header: "Name",
                        accessor: "show.name"
                    },
                    {
                        Header: "Type",
                        accessor: "show.type"
                    }
                ]
            },
            {
                // Second group - Details
                Header: "Details",
                // Second group columns
                columns: [
                    {
                        Header: "Language",
                        accessor: "show.language"
                    },
                    {
                        Header: "Genre(s)",
                        accessor: "show.genres"
                    },
                    {
                        Header: "Runtime",
                        accessor: "show.runtime"
                    },
                    {
                        Header: "Status",
                        accessor: "show.status"
                    }
                ]
            }
        ],
        []
    );

    const [data, setData] = useState([]);

    // Using useEffect to call the API once mounted and set the data
    useEffect(() => {
        (async () => {
            const result = await axios("https://api.tvmaze.com/search/shows?q=snow");
            setData(result.data);
        })();
    }, []);
    return (
        <div className='stake-card'>
            <div className='stake-card-header'>
                <h2 className='ff-sans bold letter-spacing-3'>Open Bounties</h2>
            </div>





            <div className='stake-card-content'>


                {/*START TABLE*/}

                <Table columns={columns} data={data} />


                {/*<div className='stake-card-content-button'>*/}
                {/*   <button onClick={approveWithdraw} className='stake-button ff-sans'>*/}
                {/*      Approve*/}
                {/*   </button>*/}
                {/*</div>*/}




                {/*END TABLE*/}



            </div>

        </div>
    );
};

export default BountyTableCard;
