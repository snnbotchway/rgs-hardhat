// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title RGToken
 * @dev A basic ERC20 token for Really Great Token (RGT).
 */
contract RGToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Really Great Token", "RGT") {
        _mint(msg.sender, initialSupply);
    }
}
