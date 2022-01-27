pragma solidity ^0.8.0;

import "./IVestingStrategy.sol";

contract VestingStrategy {
    uint256 cliffDuration; 
    uint256 vestingDuration; 

    constructor (uint256 cliffDurationInDays, uint256 vestingDurationInDays) {
        cliffDuration = cliffDurationInDays * 1 days;
        vestingDuration = vestingDurationInDays * 1 days;
    }

    // how much the user can withdraw at the moment
    function calculate(uint256 startTime_, uint256 stakeBalance_) public view returns (uint256) {
        if (block.timestamp > startTime_ + cliffDuration) {
            if (block.timestamp > startTime_ + cliffDuration + vestingDuration) {
                return stakeBalance_;
            }
            return (block.timestamp - cliffDuration) * stakeBalance_ / vestingDuration;
        }
        return 0;
    }
}