const { expect, use } = require("chai");
const { ethers } = require("hardhat");

async function addTime(additionalTime) {
  await network.provider.send("evm_increaseTime", [Number(additionalTime)])
  await ethers.provider.send('evm_mine');
}

describe("Contract test", function () {
  let owner, VestingStrategy, firstVestingStrategy, secondVestingStrategy;
  let Token, token, VestingStaking, vestingStaking;
  let user1, user2, user3;
  let vestingStrategies;
  const oneDay = 86400;

  beforeEach(async () => {
    [owner, user1, user2, user3] = await ethers.getSigners();
    VestingStrategy = await ethers.getContractFactory("VestingStrategy");
    vestingStrategies = {first: 0, second: 1};
    firstVestingStrategy = await VestingStrategy.deploy(15, 15);
    secondVestingStrategy = await VestingStrategy.deploy(15, 30);
    await firstVestingStrategy.deployed();
    await secondVestingStrategy.deployed();

    Token = await ethers.getContractFactory("Token");
    token = await Token.deploy();
    await token.deployed();
    
    VestingStaking = await ethers.getContractFactory("VestingStaking");
    vestingStaking = await VestingStaking.deploy(token.address);
    await vestingStaking.deployed();
    await token.grantMinterRole(vestingStaking.address);
    await vestingStaking.initVestingStrategies(firstVestingStrategy.address, secondVestingStrategy.address);
  });
  it("call functions before start with revert", async function() {
    await expect(vestingStaking.increaseRewardPool(300)).to.be.revertedWith("function cannot be called in this contract state");
  });
  it("double addToWhitelist", async function() {
    await vestingStaking.addToWhitelist(user1.address);
    await expect(vestingStaking.addToWhitelist(user1.address)).to.be.revertedWith("account already whitelisted");
  });
  it("removeFromWhitelist when account not in whitelist", async function() {
    await expect(vestingStaking.removeFromWhiteList(user1.address)).to.be.revertedWith("account not whitelisted");
  });
  it("user init test", async function() {
    await token.transfer(user1.address, 500);
    await token.transfer(user2.address, 1000);
    await token.connect(user1).increaseAllowance(vestingStaking.address, 500);
    await token.connect(user2).increaseAllowance(vestingStaking.address, 1000);
    let users = [
      {account: user1.address, staked: 500, vestingType: vestingStrategies.first},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
    ]
    await vestingStaking.initUsers(users);
    await expect(vestingStaking.addToWhitelist(user1.address)).to.be.revertedWith("already whitelisted");
    await expect(vestingStaking.addToWhitelist(user2.address)).to.be.revertedWith("already whitelisted");

    await vestingStaking.start(10, 1000);

    await expect(vestingStaking.connect(user1).withdraw(1)).to.be.revertedWith("can't withdraw that amount of tokens");
    addTime(18 * oneDay);
    
    let oldBalance = await token.balanceOf(user1.address);
    await vestingStaking.connect(user1).withdraw(10);
    expect(await token.balanceOf(user1.address)).to.equal(BigInt(oldBalance) + BigInt(10));


  });
  it("big user init test", async function() {
    let users = [
      {account: user1.address, staked: 500, vestingType: vestingStrategies.first},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
      {account: user2.address, staked: 1000, vestingType: vestingStrategies.second},
    ]
    await expect(vestingStaking.initUsers(users)).to.be.revertedWith("length > 10");
  });
  describe("Staking test", function () {
    let rewardPerDay;
    beforeEach(async () => {
      rewardPerDay = 10;
      vestingStaking.start(rewardPerDay, 1000);
      token.transfer(user1.address, 1100);
      token.transfer(user2.address, 2000);
      token.transfer(user3.address, 3000);
      token.connect(user1).increaseAllowance(vestingStaking.address, 1000);
      token.connect(user2).increaseAllowance(vestingStaking.address, 1000);
      vestingStaking.addToWhitelist(user1.address);
    });
    it("correct staking test", async function() {
      await vestingStaking.connect(user1).stake(500, vestingStrategies.first);
    });
    it("not whitelisted user staking", async function() {
      await expect(vestingStaking.connect(user2).stake(100, vestingStrategies.first)).to.be.reverted;
    });
    it("double staking", async function() {
      await vestingStaking.connect(user1).stake(300, vestingStrategies.first);
      await expect(vestingStaking.connect(user1).stake(200, vestingStrategies.first)).to.be.revertedWith("user is staking");
    });
    it("withdraw when not staked", async function() {
      await expect(vestingStaking.connect(user1).withdraw(10)).to.be.revertedWith("user isn't staking");
    }); 
    it("staking after removing from whitelist", async function() {
      await vestingStaking.removeFromWhiteList(user1.address);
      await expect(vestingStaking.connect(user1).stake(200, vestingStrategies.first)).to.be.reverted;
    });
    it("failed stake", async function() {
      await expect(vestingStaking.connect(user1).stake(0, vestingStrategies.first)).to.be.revertedWith("amount is 0");
      await expect(vestingStaking.connect(user1).stake(1101, vestingStrategies.first)).to.be.revertedWith("sender doesn't have that amount of tokens on balance");
      await expect(vestingStaking.connect(user1).stake(1001, vestingStrategies.first)).to.be.revertedWith("contract can't spend that amount of tokens");
    });

    describe("Vesting test", function() {
      beforeEach(async () => {
        await vestingStaking.connect(user1).stake(1000, vestingStrategies.first);
      });
      it("withdraw during cliff stage", async function() {
        await expect(vestingStaking.connect(user1).withdraw(1)).revertedWith("can't withdraw that amount of tokens");
      });
      it("correct withdraw", async function () {
        let balanceBeforeWithdraw = await token.balanceOf(user1.address);
        addTime(18 * oneDay); 
        expect(await vestingStaking.connect(user1).claimLeft()).to.equal(200);
        await vestingStaking.connect(user1).withdraw(200);
        expect(await token.balanceOf(user1.address)).to.equal(BigInt(balanceBeforeWithdraw) + BigInt(200));
      });
      it("withdraw more than user can at the moment", async function() {
        addTime(18 * oneDay);
        await expect(vestingStaking.connect(user1).withdraw(201)).to.be.revertedWith("can't withdraw that amount of tokens");
      });
      it("withdraw when vesting ended", async function() {
        let balanceBeforeWithdraw = await token.balanceOf(user1.address);
        addTime(30 * oneDay);
        await vestingStaking.connect(user1).withdraw(1000);
        expect(await token.balanceOf(user1.address)).to.equal(BigInt(balanceBeforeWithdraw) + BigInt(1000));
      });
      it("TVL", async function() {
        expect(await vestingStaking.connect(user1).getTVL()).to.equal(1000);
        await vestingStaking.addToWhitelist(user2.address);
        await vestingStaking.connect(user2).stake(500, vestingStrategies.first);
        expect(await vestingStaking.connect(user2).getTVL()).to.equal(1500);
      });
      it("full amount of tokens", async function() {
        expect(await vestingStaking.connect(user1).getFullAmountOfTokens()).to.equal(100000);
      });
      
    })

    describe("Reward test", function() {
      beforeEach(async () => {
        await vestingStaking.addToWhitelist(user2.address);
      });
      it("get reward", async function() {
        await vestingStaking.connect(user1).stake(1000, vestingStrategies.first);
        let oldUser1Balance = await token.balanceOf(user1.address);
        await vestingStaking.connect(user1).getReward();
        expect(await token.balanceOf(user1.address)).to.equal(oldUser1Balance);
        addTime(oneDay);
        await vestingStaking.connect(user1).getReward();
        expect(await token.balanceOf(user1.address)).to.equal(BigInt(oldUser1Balance) + BigInt(rewardPerDay));

        await vestingStaking.connect(user2).stake(1000, vestingStrategies.second);
        oldUser1Balance = await token.balanceOf(user1.address);
        let oldUser2Balance = await token.balanceOf(user2.address);
        addTime(oneDay * 10);
        await vestingStaking.connect(user1).getReward();
        await vestingStaking.connect(user2).getReward();
        expect(await token.balanceOf(user1.address)).to.equal(BigInt(oldUser1Balance) + BigInt(rewardPerDay) * BigInt(10) / BigInt(2));
        expect(await token.balanceOf(user2.address)).to.equal(BigInt(oldUser2Balance) + BigInt(rewardPerDay) * BigInt(10) / BigInt(2));
        addTime(oneDay * 500);
        await expect(vestingStaking.connect(user1).getReward()).to.be.revertedWith("reward pool less than reward");
        vestingStaking.increaseRewardPool(5000);
        token.transfer(vestingStaking.address, 5000);
        oldUser1Balance = await token.balanceOf(user1.address);
        await vestingStaking.connect(user1).getReward();
        expect(await token.balanceOf(user1.address)).to.equal(BigInt(oldUser1Balance) + BigInt(2500));

      });
    });
    describe("APY test", function() {
      it("nothing is staked", async function() {
        expect(await vestingStaking.connect(user1).calculateAPYNotStaked(1000)).to.equal(365);
        expect(await vestingStaking.connect(user1).calculateAPYNotStaked(500)).to.equal(730);
      });
      it("same APY", async function() {
        await vestingStaking.connect(user1).stake(10, vestingStrategies.first);
        await vestingStaking.addToWhitelist(user2.address);
        await vestingStaking.connect(user2).stake(1000, vestingStrategies.first);
        let firstUserAPY = await vestingStaking.connect(user1).calculateAPYStaked();
        let secondUserAPY = await vestingStaking.connect(user2).calculateAPYStaked()
        expect(firstUserAPY).to.equal(secondUserAPY);

        await vestingStaking.addToWhitelist(user3.address);
        token.connect(user3).increaseAllowance(vestingStaking.address, 1000);
        await vestingStaking.connect(user3).stake(450, vestingStrategies.first);
        firstUserAPY = await vestingStaking.connect(user1).calculateAPYStaked();
        secondUserAPY = await vestingStaking.connect(user2).calculateAPYStaked();
        let thirdUserAPY = await vestingStaking.connect(user3).calculateAPYStaked();


        expect(firstUserAPY).to.equal(secondUserAPY).to.equal(thirdUserAPY);
        let oldFirstAPY = firstUserAPY;
      });
    });
  });
});
