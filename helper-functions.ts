import { BigNumber, BigNumberish } from "ethers"
import { ethers, run } from "hardhat"
import { Address } from "hardhat-deploy/types"

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import { TOTAL_REWARD_POOL } from "./helper-hardhat-config"
import { RGStaking, RGToken } from "./typechain"

export const verify = async (contractAddress: string, contract: string, args: any[]) => {
    console.log("Verifying contract...")
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
            contract,
        })
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!")
        } else {
            console.log(e)
        }
    }
}

export const initializeRewardPool = async (signer: Address | SignerWithAddress) => {
    const rGToken: RGToken = await ethers.getContract("RGToken")
    const rGStaking: RGStaking = await ethers.getContract("RGStaking", signer)

    const isInitialized = await rGStaking.isRewardPoolInitialized()

    if (isInitialized) {
        console.log("Already Initialized.")
        return
    }

    const approveTx = await rGToken.approve(rGStaking.address, TOTAL_REWARD_POOL)
    await approveTx.wait(1)

    const initTx = await rGStaking.initializeRewardPool()
    await initTx.wait(1)
}

export const parseRGT = (rGTAmount: BigNumberish): BigNumber => {
    return ethers.utils.parseUnits(rGTAmount.toString(), 18)
}
