const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Mintable Token test", function () {
  let account, Token, token;
  beforeEach(async () => {
    [account, minter, notMinter] = await ethers.getSigners();
    Token = await ethers.getContractFactory("Token");
    token = await Token.deploy();
    await token.deployed();
    await token.grantMinterRole(minter.address);
  });
  it("minter can mint", async function () {
    let balanceBeforeMint = await token.balanceOf(minter.address);
    await token.connect(minter).mint(minter.address, 10);
    expect(await token.balanceOf(minter.address)).to.equal(balanceBeforeMint + 10);
  });
  it("not minter can't mint", async function () {
    await expect(token.connect(notMinter).mint(notMinter.address, 10)).to.be.reverted;
  });
});
