# How to deploy and interact with ventaInmueble Hyperledger Fabric network

This guide provides step-by-step instructions for deploying and interacting with the ventaInmueble network in Hyperledger Fabric using the files provided in this repository. The ventaInmueble network simulates a regulated real estate market involving public administrations ("AAPP"), construction companies ("constructoras"), and consumers ("particulares"), each represented by a single peer. These organizations approve transactions related to property registration, sale, and purchase, helping public organizations regulate the market and promote transparency.

## Deployment

This project was developed with the following software:

- Ubuntu 22.04.2 LTS
- Docker 24.0.2
- Docker Compose 1.29.2
- Node.js v12.22.9
- Hyperledger Fabric 2.3.3

### Necessary extensions

Before proceeding, ensure that your system packages are updated and install the necessary tools, including npm, curl, jq, Docker, and Docker Compose:

```
sudo apt update
sudo apt upgrade

sudo apt install npm
sudo apt install curl
sudo apt install jq
curl -fsSL https://get.docker.com -o get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
```

Clone the hyperledger/fabric-samples repository to access the binaries and scripts required for deploying your network:

```
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.3.3 1.5.2
```

### Cleaning up

To ensure a clean start, remove existing containers, volumes, and networks:

```
docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)
docker volume rm $(docker volume ls -q)
docker volume prune
docker network prune
```

Whenever you intend to deploy the network, clear the organizations and channel-artifacts folders inside the repository:

```
cd ventaInmueble
rm -rf organizations/peerOrganizations
rm -rf organizations/ordererOrganizations
rm -rf channel-artifacts/
mkdir channel-artifacts
```

### Generate certificates and deploy the network

Set up the necessary environment variables for running Docker scripts:

```
export COMPOSE_PROJECT_NAME=venta-inmueble-test
export IMAGE_TAG=latest
```

Also, export variables to locate the binaries and configurations cloned from the fabric-samples repository:

```
export PATH=${PWD}/../fabric-samples/bin:${PWD}:$PATH
export FABRIC_CFG_PATH=${PWD}/../fabric-samples/config
```

Use the cryptogen tool to generate cryptographic material (keys and certificates) required for communication between organizations, peers, and orderers. Configuration files inside organizations/cryptogen are provided in the repository, based on fabric-samples config files:

```
cryptogen generate --config=./organizations/cryptogen/crypto-config-constructoras.yaml --output="organizations"
cryptogen generate --config=./organizations/cryptogen/crypto-config-particulares.yaml --output="organizations"
cryptogen generate --config=./organizations/cryptogen/crypto-config-aapp.yaml --output="organizations"
cryptogen generate --config=./organizations/cryptogen/crypto-config-orderer.yaml --output=organizations
```

Deploy the network with its participants. In the docker-compose.yaml file, the elements and configuration of the network is defined. These are the participants: three peer nodes and one orderer node. Assigned to them there are three volumes. In addition, there is a Hyperledger Fabric CLI container. Also, the tree peer nodes will use a CouchDB database. Alltogether, they will interact in a network called "fabirc_test". The containers use images provided by the Hyperledger Fabric project. Other configurations like the port mapping or protocol definition can be seen and updated in this file.

```
docker-compose -f net/docker-compose-red.yaml up -d
```

### Setting up the channel

The network is now running, but there is no channel yet where participants can interact. Create the network using the configtxgen binary from fabric-samples. The channel configuration is available in this repository, with fabric-samples' default configuration as a reference. The ThreeGenesis profile defines participation from three organizations: AAPP, Particulares, Constructoras, and one orderer:

```
export FABRIC_CFG_PATH=${PWD}/configtx
configtxgen -profile ThreeGenesis -outputBlock ./channel-artifacts/canal-venta-inmueble.block -channelID canal-venta-inmueble
```

Deploy the channel in the orderer, exporting environment variables linked to the certificates:

```
export FABRIC_CFG_PATH=${PWD}/../fabric-samples/config
export ORDERER_CA=${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem
export ORDERER_ADMIN_TLS_SIGN_CERT=${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/tls/server.crt
export ORDERER_ADMIN_TLS_PRIVATE_KEY=${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/tls/server.key

osnadmin channel join --channelID canal-venta-inmueble --config-block ./channel-artifacts/canal-venta-inmueble.block -o localhost:7053 --ca-file "$ORDERER_CA" --client-cert "$ORDERER_ADMIN_TLS_SIGN_CERT" --client-key "$ORDERER_ADMIN_TLS_PRIVATE_KEY"
osnadmin channel list -o localhost:7053 --ca-file "$ORDERER_CA" --client-cert "$ORDERER_ADMIN_TLS_SIGN_CERT" --client-key "$ORDERER_ADMIN_TLS_PRIVATE_KEY"
```

Next, have the three organization peers join the channel:

```
export CORE_PEER_TLS_ENABLED=true
export PEER0_CONSTRUCTORAS_CA=${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt
export CORE_PEER_LOCALMSPID="constructoras"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_CONSTRUCTORAS_CA
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/constructoras.com/users/Admin@constructoras.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer channel join -b ./channel-artifacts/canal-venta-inmueble.block

export PEER0_PARTICULARES_CA=${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt
export CORE_PEER_LOCALMSPID="particulares"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_PARTICULARES_CA
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/particulares.com/users/Admin@particulares.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer channel join -b ./channel-artifacts/canal-venta-inmueble.block

export PEER0_AAPP_CA=${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt
export CORE_PEER_LOCALMSPID="aapp"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_AAPP_CA
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/aapp.com/users/Admin@aapp.com/msp
export CORE_PEER_ADDRESS=localhost:10051
peer channel join -b ./channel-artifacts/canal-venta-inmueble.block
```

### Anchor peer setup

In this section, we will define anchor peers for the three organizations within our project. For our project's specific configuration, each organization's single peer will also serve as the anchor peer. To accomplish this, we will make use of the configtxlator tool, which is provided in the fabric-samples, and jq for JSON manipulation.

First, the environment variables needed are set. After that, we will fetch the existing channel configuration, decode it, and transform it into a JSON format, making it more manageable for further modifications.

```
export CORE_PEER_LOCALMSPID="constructoras"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_CONSTRUCTORAS_CA
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/constructoras.com/users/Admin@constructoras.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer channel fetch config channel-artifacts/config_block.pb -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com -c canal-venta-inmueble --tls --cafile "$ORDERER_CA"

cd channel-artifacts

configtxlator proto_decode --input config_block.pb --type common.Block --output config_block.json

jq '.data.data[0].payload.data.config' config_block.json > config.json
```

Subsequently, we will make changes to the channel configuration to define the anchor peer. To do this, we will create a copy of the original configuration and use jq to include anchor peer information for the "constructoras" organization.

```
cp config.json config_copy.json
jq '.channel_group.groups.Application.groups.constructoras.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "peer0.constructoras.com","port": 7051}]},"version": "0"}}' config_copy.json > modified_config.json

configtxlator proto_encode --input config.json --type common.Config --output config.pb
configtxlator proto_encode --input modified_config.json --type common.Config --output modified_config.pb

configtxlator compute_update --channel_id canal-venta-inmueble --original config.pb --updated modified_config.pb --output config_update.pb
```

Lastly, we will wrap the configuration update into the required structure to make the modification effective within the channel. This involves decoding, structuring, encoding, and applying the channel configuration update.

```
configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate --output config_update.json
echo '{"payload":{"header":{"channel_header":{"channel_id":"canal-venta-inmueble", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . > config_update_in_envelope.json

configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope --output config_update_in_envelope.pb

cd ..

peer channel update -f channel-artifacts/config_update_in_envelope.pb -c canal-venta-inmueble -o localhost:7050  --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile "$ORDERER_CA"
```

We will follow the same procedure for the other two organizations:

```
export CORE_PEER_LOCALMSPID="particulares"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_PARTICULARES_CA
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/particulares.com/users/Admin@particulares.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer channel fetch config channel-artifacts/config_block.pb -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com -c canal-venta-inmueble --tls --cafile "$ORDERER_CA"
cd channel-artifacts
configtxlator proto_decode --input config_block.pb --type common.Block --output config_block.json
jq '.data.data[0].payload.data.config' config_block.json > config.json
cp config.json config_copy.json
jq '.channel_group.groups.Application.groups.particulares.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "peer0.particulares.com","port": 9051}]},"version": "0"}}' config_copy.json > modified_config.json
configtxlator proto_encode --input config.json --type common.Config --output config.pb
configtxlator proto_encode --input modified_config.json --type common.Config --output modified_config.pb
configtxlator compute_update --channel_id canal-venta-inmueble --original config.pb --updated modified_config.pb --output config_update.pb
configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate --output config_update.json
echo '{"payload":{"header":{"channel_header":{"channel_id":"canal-venta-inmueble", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . > config_update_in_envelope.json
configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope --output config_update_in_envelope.pb

cd ..
peer channel update -f channel-artifacts/config_update_in_envelope.pb -c canal-venta-inmueble -o localhost:7050  --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile "$ORDERER_CA"

export CORE_PEER_LOCALMSPID="aapp"
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_AAPP_CA
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/aapp.com/users/Admin@aapp.com/msp
export CORE_PEER_ADDRESS=localhost:10051

peer channel fetch config channel-artifacts/config_block.pb -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com -c canal-venta-inmueble --tls --cafile "$ORDERER_CA"
cd channel-artifacts
configtxlator proto_decode --input config_block.pb --type common.Block --output config_block.json
jq '.data.data[0].payload.data.config' config_block.json > config.json
cp config.json config_copy.json
jq '.channel_group.groups.Application.groups.aapp.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "peer0.aapp.com","port": 10051}]},"version": "0"}}' config_copy.json > modified_config.json
configtxlator proto_encode --input config.json --type common.Config --output config.pb
configtxlator proto_encode --input modified_config.json --type common.Config --output modified_config.pb
configtxlator compute_update --channel_id canal-venta-inmueble --original config.pb --updated modified_config.pb --output config_update.pb
configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate --output config_update.json
echo '{"payload":{"header":{"channel_header":{"channel_id":"canal-venta-inmueble", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . > config_update_in_envelope.json
configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope --output config_update_in_envelope.pb
cd ..

peer channel update -f channel-artifacts/config_update_in_envelope.pb -c canal-venta-inmueble -o localhost:7050  --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile "$ORDERER_CA"
peer channel getinfo -c canal-venta-inmueble
```

### Preparing, installing and approving the chaincode

Navigate to the chaincode folder and build the npm project. The chaincode has been developed in JavaScript language. Afterward, generate the package for installation in the peers:

```
cd chaincode
npm install

cd ./..
export PATH=${PWD}/../fabric-samples/bin:${PWD}:$PATH
export FABRIC_CFG_PATH=${PWD}/../fabric-samples/config
peer lifecycle chaincode package venta-inmueble-chaincode.tar.gz --path ./chaincode/ --lang node --label test_1.0
```

Install the chaincode on the three peers:

```
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="constructoras"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/constructoras.com/users/Admin@constructoras.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode install venta-inmueble-chaincode.tar.gz

export CORE_PEER_LOCALMSPID="particulares"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/particulares.com/users/Admin@particulares.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode install venta-inmueble-chaincode.tar.gz

export CORE_PEER_LOCALMSPID="aapp"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/aapp.com/users/Admin@aapp.com/msp
export CORE_PEER_ADDRESS=localhost:10051
peer lifecycle chaincode install venta-inmueble-chaincode.tar.gz
```

Export the CC_PACKAGE_ID variable according with the id of the package you have installed:

```
peer lifecycle chaincode queryinstalled
export CC_PACKAGE_ID=test_1.0:18fd0969000fc5d85e2cb3726ad12a6eb3ecebb690dfaacb0f42cb58b1597657
```

Approve the chaincode for the three organizations now that the chaincode has already been istalled in their respective peers. With this command we will also define the Endorsement Policy. As we aim to approve the channel queries by all three organizations strictly, we will use the default policy (it is not explicitly seen in this command), where the three organizations have to endorse the transactions: AND('aapp.member','constructoras.member', 'particulares.member')

```
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --channelID canal-venta-inmueble --name test --version 1.0 --package-id $CC_PACKAGE_ID --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem

export CORE_PEER_LOCALMSPID="constructoras"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/constructoras.com/users/Admin@constructoras.com/msp
export CORE_PEER_ADDRESS=localhost:7051
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --channelID canal-venta-inmueble --name test --version 1.0 --package-id $CC_PACKAGE_ID --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem

export CORE_PEER_LOCALMSPID="particulares"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/particulares.com/users/Admin@particulares.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --channelID canal-venta-inmueble --name test --version 1.0 --package-id $CC_PACKAGE_ID --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem

```

Verify that the chaincode has been successfully installed in all organizations:

```
peer lifecycle chaincode checkcommitreadiness --channelID canal-venta-inmueble --name test --version 1.0 --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem --output json
```

To finalize the chaincode definition and commit it to the channel, use the following command:

```
peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --channelID canal-venta-inmueble --name test --version 1.0 --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem --peerAddresses localhost:7051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt
```

Retrieve information about the committed chaincode in the channel and verify the approvals:

```
peer lifecycle chaincode querycommitted --channelID canal-venta-inmueble --name test --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem
```

## Interacting with the network

Now that the network is set up, launch the chaincode for the first time. The "InitLedger" function creates initial assets (properties) for further interactions, requiring approvals from all three organizations:

```
peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem -C canal-venta-inmueble -n test --peerAddresses localhost:7051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt -c '{"function":"InitLedger","Args":[]}'
```

To display the objects/assets/properties created, use the GetTodosInmuebles function. In this case, queries in the Hyperledger Fabric network don't require endorsement from all organizations; the orderer alone is allowed to query regardless of the Endorsement Policy chosen:

```
peer chaincode query -C canal-venta-inmueble -n test -c '{"Args":["GetTodosInmuebles"]}'
```

Now, register a new property. After that, the property will be sold from the "constructoras" to a first-hand buyer ("particular"). Finally, the owner of the property will sell it again to a second-hand buyer (also "particular"). Note that the owner and prices change, and this information will be registered in the network:

```
peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem -C canal-venta-inmueble -n test --peerAddresses localhost:7051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt -c '{"function":"RegistrarInmueble","Args":["I00006", "c/ Martes 13, 2B, 22090, Oviedo, Espana", "C00006"]}'

peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem -C canal-venta-inmueble -n test --peerAddresses localhost:7051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt -c '{"function":"VenderInmueble","Args":["I00006", "C00007", "312000"]}'

peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem -C canal-venta-inmueble -n test --peerAddresses localhost:7051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt -c '{"function":"VenderInmueble","Args":["I00006", "C00008", "330000"]}'
```

## Explore the network

In this section, we'll explore two essential tools for visualizing and monitoring your Hyperledger Fabric network. Although the setup for using these services has already been completed in the provided files in the repository, we'll provide detailed explanations for readers who are interested in understanding the process.

### Overview your network with Hyperledger Explorer

Hyperledger Explorer offers a user-friendly interface designed to facilitate interaction with and monitoring of Hyperledger Fabric networks. It simplifies the tasks of exploring, querying, and visualizing blockchain data, providing valuable insights into your network.

To get started, follow these steps to set up Hyperledger Explorer. Create a dedicated folder for your Hyperledger Explorer configuration. Next, download three essential files from the official repository:

- docker-compose.yaml: This file orchestrates the deployment of containers for the Explorer service and its associated database.
- test-network.json (found inside a "connection-profile" folder): This file defines the configuration necessary to access the Hyperledger Fabric network from a specific participant.
- config.json: This configuration file will be used to customize Hyperledger Explorer's behavior.

```
cd ..
mkdir explorer
cd explorer

wget https://raw.githubusercontent.com/hyperledger/blockchain-explorer/main/examples/net1/config.json
wget https://raw.githubusercontent.com/hyperledger/blockchain-explorer/main/examples/net1/connection-profile/test-network.json -P connection-profile
wget https://raw.githubusercontent.com/hyperledger/blockchain-explorer/main/docker-compose.yaml
```

Please note that you need to update the test-network.json file with the correct values for the client, channels, organizations, and peers objects. The configuration in this file depends on the client connecting to the service. In the provided file, all organizations and peers are included, but the client is set to be the "aapp" organization. Therefore, including this organization and its peer in the JSON file is sufficient to deploy Explorer.

In the docker-compose.yaml file, make the following adjustments:

- Replace the network name with the appropriate name that matches your deployed Hyperledger Fabric network.
- Update the volume paths to correspond to the actual paths where the necessary files should be located:

```
    volumes:
      - ./config.json:/opt/explorer/app/platform/fabric/config.json
      - ./connection-profile:/opt/explorer/app/platform/fabric/connection-profile
      - ./../organizations:/tmp/crypto
      - walletstore:/opt/explorer/wallet
```

With these configurations in place, you can deploy the containers:

```
docker-compose up -d
```

As specified in the configuration, you can access the Hyperledger Explorer service on port 8080 of your machine. Use the provided credentials found in the test-network.json file (username: "exploreradmin" and password: "exploreradmin") to log in.

This setup allows you to efficiently visualize and explore your Hyperledger Fabric network using the Hyperledger Explorer tool.

### Monitor your network with Prometheus and Grafana

Prometheus is an open-source monitoring and alerting toolkit designed to efficiently collect, store, and query metrics and time-series data from diverse sources. It excels at monitoring complex, dynamic, and distributed systems. Grafana, on the other hand, is an open-source observability platform that seamlessly integrates with various data sources, including Prometheus. Similar to Hyperledger Explorer, Grafana offers a user-friendly and highly customizable interface for creating interactive dashboards, visualizing metrics, and configuring alerts.

1. Create a Monitoring Folder: Begin by creating a dedicated folder to manage monitoring configurations.
2. Configure Prometheus: Generate a prometheus.yaml file to define the jobs responsible for targeting the nodes in your Hyperledger Fabric network. Ensure that Prometheus listens on the ports specified in your Hyperledger Fabric network's configuration (found in the Fabric network docker-compose.yaml file) under the environment variables CORE_OPERATIONS_LISTENADDRESS and ORDERER_OPERATIONS_LISTENADDRESS for peers and orderers, respectively.
3. Deploy Prometheus and Grafana: In the docker-compose.yml file, specify the services you need:
   - The Prometheus service links to the volume specified in the prometheus.yaml file.
   - The Grafana service is deployed and accessible at localhost:3000.
4. Start the containers:

```
docker-compose up -d
```

5. Verifying metrics. To ensure that Prometheus is successfully fetching metrics from each node, you can visit localhost:9090/targets. To view the raw data, navigate to each node's respective port defined in your local machine. Keep in mind that the endpoints managed by Prometheus correspond to your network and not your local machine. For example, metrics available at http://peer0.aapp.com:12051/metrics in the Hyperledger Fabric network can be fetched locally at localhost:12051/metrics in your browser.

6. Once Prometheus and Grafana containers are up, and your Fabric network is running, you can access Grafana at localhost:3000. Use the following login credentials: Username: admin, Password: admin.

- Add Prometheus Data Source: Configure Grafana to connect to Prometheus by specifying the Prometheus server URL, which should be http://prometheus:9090 in your case, and use the GET HTTP method.
- Import a Dashboard: Grafana offers an existing dashboard for Hyperledger Fabric, which you can import from a JSON file. You can find the pre-built dashboard at Grafana's dashboard repository: https://grafana.com/grafana/dashboards/10716-hyperledger-fabric/

With Prometheus and Grafana set up, you can closely monitor your Hyperledger Fabric network, gain insights, and create customized dashboards to visualize and understand your blockchain's performance and health.
