const { expect } = require("chai");
const { ethers } = require("hardhat");


async function addTime(additionalTime) {
  await network.provider.send("evm_increaseTime", [Number(additionalTime)])
  await ethers.provider.send('evm_mine');
}

describe("Vesting Strategy test", function () {
  let account, VestingStrategy, firstVestingStrategy, secondVestingStrategy, beginTimestamp = Math.floor(Date.now() / 1000);
  const oneDay = 86400;
  beforeEach(async () => {
    [account] = await ethers.getSigners();
    VestingStrategy = await ethers.getContractFactory("VestingStrategy");
    firstVestingStrategy = await VestingStrategy.deploy(15, 15);
    await firstVestingStrategy.deployed();
  });
  it("calculate test", async function () {
    expect(await firstVestingStrategy.calculate(beginTimestamp, 10)).to.equal(0);
    await addTime(20 * oneDay);
    expect(await firstVestingStrategy.calculate(beginTimestamp, 10)).to.equal(3);
    await addTime(11 * oneDay);
    expect(await firstVestingStrategy.calculate(beginTimestamp, 10)).to.equal(10);
  });
});
