import { keccak256 } from '@ethersproject/solidity'
import { randomBytes } from '@ethersproject/random'
import { hexlify } from '@ethersproject/bytes'

import assertRevert from '../helpers/assertRevert'
import { getInitData, ZERO_ADDRESS, ITEMS, SALT } from '../helpers/collectionV2'
import { expect } from 'chai'

const ERC721CollectionFactoryV2 = artifacts.require('ERC721CollectionFactoryV2')
const ERC721CollectionV2 = artifacts.require('ERC721CollectionV2')

function encodeERC721Initialize(
  name,
  symbol,
  creator,
  shouldComplete,
  baseURI,
  proofOfCreation,
  items
) {
  return web3.eth.abi.encodeFunctionCall(
    {
      inputs: [
        {
          internalType: 'string',
          name: '_name',
          type: 'string',
        },
        {
          internalType: 'string',
          name: '_symbol',
          type: 'string',
        },
        {
          internalType: 'address',
          name: '_creator',
          type: 'address',
        },
        {
          internalType: 'bool',
          name: '_shouldComplete',
          type: 'bool',
        },
        {
          internalType: 'string',
          name: '_baseURI',
          type: 'string',
        },
        {
          internalType: 'bytes32',
          name: '_proofOfCreation',
          type: 'bytes32',
        },
        {
          components: [
            {
              internalType: 'enum ERC721BaseCollectionV2.RARITY',
              name: 'rarity',
              type: 'uint8',
            },
            {
              internalType: 'uint256',
              name: 'totalSupply',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'price',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: 'beneficiary',
              type: 'address',
            },
            {
              internalType: 'string',
              name: 'metadata',
              type: 'string',
            },
            {
              internalType: 'bytes32',
              name: 'contentHash',
              type: 'bytes32',
            },
          ],
          internalType: 'struct ERC721BaseCollectionV2.Item[]',
          name: '_items',
          type: 'tuple[]',
        },
      ],
      name: 'initialize',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    [name, symbol, creator, shouldComplete, baseURI, proofOfCreation, items]
  )
}

describe('Factory V2', function () {
  let collectionImplementation
  let factoryContract

  // Accounts
  let accounts
  let deployer
  let user
  let factoryOwner
  let hacker
  let fromUser
  let fromHacker
  let fromFactoryOwner

  let creationParams

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    deployer = accounts[0]
    user = accounts[1]
    factoryOwner = accounts[3]
    hacker = accounts[4]

    fromUser = { from: user }
    fromHacker = { from: hacker }

    fromFactoryOwner = { from: factoryOwner }

    creationParams = {
      ...fromFactoryOwner,
      gas: 9e6,
      gasPrice: 21e9,
    }

    collectionImplementation = await ERC721CollectionV2.new()

    factoryContract = await ERC721CollectionFactoryV2.new(
      collectionImplementation.address,
      factoryOwner
    )
  })

  describe('create factory', async function () {
    it('deploy with correct values', async function () {
      const collectionImpl = await ERC721CollectionV2.new(creationParams)
      const contract = await ERC721CollectionFactoryV2.new(
        collectionImpl.address,
        factoryOwner
      )

      const impl = await contract.implementation()
      const owner = await contract.owner()
      const code = await contract.code()
      const codeHash = await contract.codeHash()

      const expectedCode = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${collectionImpl.address.replace(
        '0x',
        ''
      )}5af43d82803e903d91602b57fd5bf3`

      expect(impl).to.be.equal(collectionImpl.address)
      expect(owner).to.be.equal(factoryOwner)
      expect(expectedCode.toLowerCase()).to.be.equal(code.toLowerCase())
      expect(web3.utils.soliditySha3(expectedCode)).to.be.equal(codeHash)
    })

    it('reverts when trying to deploy with an invalid implementation', async function () {
      await assertRevert(
        ERC721CollectionFactoryV2.new(user, factoryOwner),
        'MinimalProxyFactoryV2#_setImplementation: INVALID_IMPLEMENTATION'
      )

      await assertRevert(
        ERC721CollectionFactoryV2.new(ZERO_ADDRESS, factoryOwner),
        'MinimalProxyFactoryV2#_setImplementation: INVALID_IMPLEMENTATION'
      )
    })
  })

  describe('getAddress', function () {
    it('should get a deterministic address on-chain', async function () {
      const salt = randomBytes(32)
      const expectedAddress = await factoryContract.getAddress(salt, user)
      const proof = keccak256(['bytes32', 'address'], [salt, user])

      const { logs } = await factoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          proofOfCreation: proof,
          creationParams,
        }),
        fromUser
      )

      expect(logs[0].args._address.toLowerCase()).to.be.equal(
        expectedAddress.toLowerCase()
      )
    })

    it('should get a deterministic address off-chain', async function () {
      const codeHash = await factoryContract.codeHash()

      const salt = randomBytes(32)

      const expectedAddress = `0x${keccak256(
        ['bytes1', 'address', 'bytes32', 'bytes32'],
        [
          '0xff',
          factoryContract.address,
          keccak256(['bytes32', 'address'], [salt, user]),
          codeHash,
        ]
      ).slice(-40)}`.toLowerCase()

      const proof = keccak256(['bytes32', 'address'], [salt, user])

      const { logs } = await factoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          proofOfCreation: proof,
          creationParams,
        }),
        fromUser
      )

      expect(logs[0].args._address.toLowerCase()).to.be.equal(
        expectedAddress.toLowerCase()
      )
    })
  })

  describe('createCollection', function () {
    const name = 'collectionName'
    const symbol = 'collectionSymbol'
    const shouldComplete = true
    const baseURI = 'collectionBaseURI'
    const items = []

    it('should create a collection', async function () {
      const salt = randomBytes(32)
      const expectedAddress = await factoryContract.getAddress(salt, user)

      const { logs } = await factoryContract.createCollection(
        salt,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          SALT,
          items
        ),
        fromUser
      )

      expect(logs.length).to.be.equal(3)

      let log = logs[0]
      expect(log.event).to.be.equal('ProxyCreated')
      expect(log.args._address).to.be.equal(expectedAddress)
      expect(log.args._salt).to.be.equal(hexlify(salt))

      log = logs[1]
      expect(log.event).to.be.equal('OwnershipTransferred')
      expect(log.args.previousOwner).to.be.equal(ZERO_ADDRESS)
      expect(log.args.newOwner).to.be.equal(factoryContract.address)

      log = logs[2]
      expect(log.event).to.be.equal('OwnershipTransferred')
      expect(log.args.previousOwner).to.be.equal(factoryContract.address)
      expect(log.args.newOwner).to.be.equal(factoryOwner)
    })

    it('should create a collection with items', async function () {
      const salt = randomBytes(32)
      const expectedAddress = await factoryContract.getAddress(salt, user)

      const { logs } = await factoryContract.createCollection(
        salt,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          SALT,
          ITEMS
        ),
        fromUser
      )

      expect(logs.length).to.be.equal(3)

      let log = logs[0]
      expect(log.event).to.be.equal('ProxyCreated')
      expect(log.args._address).to.be.equal(expectedAddress)
      expect(log.args._salt).to.be.equal(hexlify(salt))

      log = logs[1]
      expect(log.event).to.be.equal('OwnershipTransferred')
      expect(log.args.previousOwner).to.be.equal(ZERO_ADDRESS)
      expect(log.args.newOwner).to.be.equal(factoryContract.address)

      log = logs[2]
      expect(log.event).to.be.equal('OwnershipTransferred')
      expect(log.args.previousOwner).to.be.equal(factoryContract.address)
      expect(log.args.newOwner).to.be.equal(factoryOwner)

      // Check collection data
      const collection = await ERC721CollectionV2.at(expectedAddress)
      const baseURI_ = await collection.baseURI()
      const creator_ = await collection.creator()
      const owner_ = await collection.owner()
      const name_ = await collection.name()
      const symbol_ = await collection.symbol()
      const isInitialized_ = await collection.isInitialized()
      const isApproved_ = await collection.isApproved()
      const isCompleted_ = await collection.isCompleted()
      const isEditable_ = await collection.isEditable()

      expect(baseURI_).to.be.equal(baseURI)
      expect(creator_).to.be.equal(user)
      expect(owner_).to.be.equal(factoryOwner)
      expect(name_).to.be.equal(name)
      expect(symbol_).to.be.equal(symbol)
      expect(isInitialized_).to.be.equal(true)
      expect(isApproved_).to.be.equal(true)
      expect(isCompleted_).to.be.equal(shouldComplete)
      expect(isEditable_).to.be.equal(true)

      const itemLength = await collection.itemsCount()

      expect(ITEMS.length).to.be.eq.BN(itemLength)

      for (let i = 0; i < ITEMS.length; i++) {
        const {
          maxSupply,
          totalSupply,
          price,
          beneficiary,
          metadata,
          contentHash,
        } = await collection.items(i)

        expect(maxSupply).to.be.eq.BN(ITEMS[i][0])
        expect(totalSupply).to.be.eq.BN(ITEMS[i][1])
        expect(price).to.be.eq.BN(ITEMS[i][2])
        expect(beneficiary.toLowerCase()).to.be.equal(ITEMS[i][3].toLowerCase())
        expect(metadata).to.be.equal(ITEMS[i][4])
        expect(contentHash).to.be.equal(ITEMS[i][5])
      }
    })

    it('should create different addresses from different salts', async function () {
      const salt1 = randomBytes(32)
      const salt2 = randomBytes(32)

      const res1 = await factoryContract.createCollection(
        salt1,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          SALT,
          ITEMS
        ),
        fromUser
      )
      const address1 = res1.logs[0].args._address

      const res2 = await factoryContract.createCollection(
        salt2,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          SALT,
          ITEMS
        ),
        fromUser
      )
      const address2 = res2.logs[0].args._address

      expect(address2).to.not.be.equal(address1)
    })

    it('reverts if initialize call failed', async function () {
      const salt = randomBytes(32)
      await assertRevert(
        factoryContract.createCollection(
          salt,
          encodeERC721Initialize(
            name,
            symbol,
            ZERO_ADDRESS,
            shouldComplete,
            baseURI,
            SALT,
            ITEMS
          ),
          fromUser
        ),
        'MinimalProxyFactory#createProxy: CALL_FAILED'
      )
    })

    it('reverts if trying to re-deploy the same collection', async function () {
      const salt = randomBytes(32)
      await factoryContract.createCollection(
        salt,
        encodeERC721Initialize(
          name,
          symbol,
          user,
          shouldComplete,
          baseURI,
          SALT,
          ITEMS
        ),
        fromUser
      )

      await assertRevert(
        factoryContract.createCollection(
          salt,
          encodeERC721Initialize(
            name,
            symbol,
            user,
            shouldComplete,
            baseURI,
            SALT,
            ITEMS
          ),
          fromUser
        ),
        'MinimalProxyFactory#createProxy: CREATION_FAILED'
      )
    })
  })

  describe('isValidCollection', function () {
    it('should return true if the collection was created by the factory', async function () {
      const salt = randomBytes(32)
      const expectedAddress = await factoryContract.getAddress(salt, user)

      const proof = keccak256(['bytes32', 'address'], [salt, user])

      const { logs } = await factoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          proofOfCreation: proof,
          creationParams,
        }),
        fromUser
      )

      let isValid = await factoryContract.isValidCollection(
        logs[0].args._address.toLowerCase()
      )
      expect(isValid).to.be.equal(true)

      isValid = await factoryContract.isValidCollection(expectedAddress)
      expect(isValid).to.be.equal(true)
    })

    it('should return false if the collection was not created by the factory', async function () {
      const anotherFactoryContract = await ERC721CollectionFactoryV2.new(
        collectionImplementation.address,
        factoryOwner
      )

      const salt = randomBytes(32)
      const expectedAddress = await anotherFactoryContract.getAddress(
        salt,
        user
      )

      const proof = keccak256(['bytes32', 'address'], [salt, user])

      const { logs } = await anotherFactoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          proofOfCreation: proof,
          creationParams,
        }),
        fromUser
      )

      let isValid = await factoryContract.isValidCollection(
        logs[0].args._address.toLowerCase()
      )
      expect(isValid).to.be.equal(false)

      isValid = await factoryContract.isValidCollection(expectedAddress)
      expect(isValid).to.be.equal(false)
    })

    it('should return false if the collection is a scam', async function () {
      const anotherFactoryContract = await ERC721CollectionFactoryV2.new(
        collectionImplementation.address,
        factoryOwner
      )

      const salt = randomBytes(32)
      const expectedAddress = await anotherFactoryContract.getAddress(
        salt,
        user
      )

      const proof = keccak256(['bytes32', 'address'], [salt, user])

      // Legit collection
      await factoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          proofOfCreation: proof,
          creationParams,
        }),
        fromUser
      )

      // Scam using the same proof
      const { logs } = await anotherFactoryContract.createCollection(
        salt,
        getInitData({
          creator: user,
          shouldComplete: true,
          proofOfCreation: proof,
          creationParams,
        }),
        fromUser
      )

      let isValid = await factoryContract.isValidCollection(
        logs[0].args._address.toLowerCase()
      )
      expect(isValid).to.be.equal(false)

      isValid = await factoryContract.isValidCollection(expectedAddress)
      expect(isValid).to.be.equal(false)
    })
  })
})
