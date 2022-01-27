pragma solidity ^0.8.0;

interface IVestingStrategy {
    function calculate(uint256 startTime_) external returns (uint256);
} 