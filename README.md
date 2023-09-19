# How to deploy and interact with ventaInmueble network

This guide provides step-by-step instructions for deploying and interacting with the ventaInmueble network in Hyperledger Fabric using the files provided in this repository. The ventaInmueble network simulates a regulated real estate market involving public administrations ("AAPP"), construction companies ("constructoras"), and consumers ("particulares"), each represented by a single peer. These organizations approve transactions related to property registration, sale, and purchase, helping public organizations regulate the market and promote transparency.

## Deployment

This project was developed with the following software:

- Ubuntu 22.04.2 LTS
- Docker 24.0.2
- Docker Compose 1.29.2
- Node.js v12.22.9
- Hyperledger Fabric 2.3.3

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
docker-compose -f docker/docker-compose-red.yaml up -d
```

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

Approve the chaincode for the three organizations now that the chaincode has already been istalled in their respective peers. Wit this command we will also define the Endorsement Policy. As we aim to approve the channel queries by all three organizations strictly, we will use the default policy (it is not explicitly seen in this command), where the three organizations have to endorse the transactions: AND('aapp.member','constructoras.member', 'particulares.member')

```
export CC_PACKAGE_ID=test_1.0:18fd0969000fc5d85e2cb3726ad12a6eb3ecebb690dfaacb0f42cb58b1597657
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
peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem -C canal-venta-inmueble -n test --peerAddresses localhost:7051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt -c '{"function":"RegistrarInmueble","Args":["I00006", "c/ Martes 13, 2B, 22090, Oviedo, Espana", "C00006", "60000D"]}'

peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem -C canal-venta-inmueble -n test --peerAddresses localhost:7051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt -c '{"function":"VenderInmueble","Args":["I00006", "C00007", "312000"]}'

peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.venta-inmueble.com --tls --cafile ${PWD}/organizations/ordererOrganizations/venta-inmueble.com/orderers/orderer.venta-inmueble.com/msp/tlscacerts/tlsca.venta-inmueble.com-cert.pem -C canal-venta-inmueble -n test --peerAddresses localhost:7051 --peerAddresses localhost:9051 --peerAddresses localhost:10051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/constructoras.com/peers/peer0.constructoras.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/particulares.com/peers/peer0.particulares.com/tls/ca.crt --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/aapp.com/peers/peer0.aapp.com/tls/ca.crt -c '{"function":"VenderInmueble","Args":["I00006", "C00008", "330000"]}'
```

## Monitoring the network
