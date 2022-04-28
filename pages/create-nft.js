/* pages/create-nft.js */
import { useState } from 'react'
import { ethers } from 'ethers'
// import { create as ipfsHttpClient } from 'ipfs-http-client'

import axios from 'axios';
import FormData from 'form-data';

import { useRouter } from 'next/router'
import Web3Modal from 'web3modal'

// const client = ipfsHttpClient('https://ipfs.infura.io:5001/api/v0')

import {
    marketplaceAddress
} from '../config'

import {
  pinata_api_key,
  pinata_api_secret
} from '../pinata.config'

import NFTMarketplace from '../artifacts/contracts/NFTMarketplace.sol/NFTMarketplace.json'

export default function CreateItem(){

    const [file, setFile] = useState(null)  // Archivo que el usuario adjunta
    const [ipfsHash, setIPFSHash] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [formInput, updateFormInput] = useState({ price: '', name: '', description: '' })
    const router = useRouter()

    const gateway = "https://gateway.pinata.cloud"

    async function selectFile(e){
      setFile(e.target.files[0])
    }

    async function uploadToPinata() {
      console.log('uploadToPinata: starting')

      // 1) Upload de file
      // initialize the form data
      let formData = new FormData()

      // append the file form data to 
      formData.append("file", file)

      let response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          maxContentLength: "Infinity",
          headers: {
            "Content-Type": `multipart/form-data;boundary=${formData._boundary}`, 
            "pinata_api_key": pinata_api_key,
            "pinata_secret_api_key": pinata_api_secret
          }
        }
      )
      console.log('pinFileToIPFS: response', response)

      // get the hash
      setIPFSHash(response.data.IpfsHash)
      setImageUrl(gateway + "/ipfs/" + response.data.IpfsHash)

      // 2) Upload JSON with metadata
      const metadata = {
        name: formInput.name,
        description: formInput.description,
        image: "ipfs://" + response.data.IpfsHash
      };


      response = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        metadata,
        {
          headers: {
            "pinata_api_key": pinata_api_key,
            "pinata_secret_api_key": pinata_api_secret
          }
        }
      )
      console.log('pinJSONToIPFS: response', response)

      // Devuelvo la ruta a la metadata
      return "ipfs://" + response.data.IpfsHash
    }

    

    async function listNFTForSale() {
        console.log("Paso 1: subimos a Pinata la imagen y la metadata");
        const nftImage = await uploadToPinata();
        console.log("Paso 2: ya tenemos Pinata la imagen", nftImage);
        const web3Modal = new Web3Modal()
        const connection = await web3Modal.connect()
        const provider = new ethers.providers.Web3Provider(connection)
        const signer = provider.getSigner()

        console.log("Paso 3: ya hemos firmado la transaccion");
    
        /* create the NFT */
        const price = ethers.utils.parseUnits(formInput.price, 'ether')
        let contract = new ethers.Contract(marketplaceAddress, NFTMarketplace.abi, signer)
        let listingPrice = await contract.getListingPrice()
        listingPrice = listingPrice.toString()
        console.log("Paso 4");
        let transaction = await contract.createToken(nftImage, price, { value: listingPrice })
        await transaction.wait()

        console.log("Paso 5");
    
        router.push('/')
    }

    return (
        <div className="flex justify-center">
          <div className="w-1/2 flex flex-col pb-12">
            <input 
              placeholder="Nombre del objeto"
              className="mt-8 border rounded p-4"
              onChange={e => updateFormInput({ ...formInput, name: e.target.value })}
            />
            <textarea
              placeholder="Descripción del objeto"
              className="mt-2 border rounded p-4"
              onChange={e => updateFormInput({ ...formInput, description: e.target.value })}
            />
            <input
              placeholder="Precio del objeto en ETH"
              className="mt-2 border rounded p-4"
              onChange={e => updateFormInput({ ...formInput, price: e.target.value })}
            />
            <input
              type="file"
              name="Asset"
              className="my-4"
              onChange={selectFile}
            />
            {
              ipfsHash.length > 0 && (
                <img className="rounded mt-4" height='175' src={imageUrl} alt='not loading'/>
              )
            }
            <button onClick={listNFTForSale} className="font-bold mt-4 bg-pink-500 text-white rounded p-4 shadow-lg">
              Crear NFT
            </button>
          </div>
        </div>
    )
}