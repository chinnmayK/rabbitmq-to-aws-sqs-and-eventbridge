# Event-Driven Microservices Architecture on AWS

### Node.js • EventBridge • SQS • Redis • DocumentDB • Docker • Terraform • CI/CD

This project demonstrates a **production-grade event-driven microservices architecture** implemented using **Node.js** and deployed on **AWS** with a fully automated **CI/CD pipeline**.

The application simulates a **grocery shopping platform** that has been refactored from a **monolithic system** into a **distributed microservices architecture**.

It showcases **enterprise-level backend architecture patterns**, including:

* Microservices
* Event-driven communication
* Asynchronous messaging
* Infrastructure as Code
* Docker container orchestration
* CI/CD automation
* Intelligent pipeline optimization
* Distributed caching
* Secure secrets management

---

# Table of Contents

1. Overview
2. Project Goals
3. Technology Stack
4. Microservices Overview
5. CI/CD Pipeline Architecture
6. Intelligent Pipeline Optimization
7. Runtime Infrastructure
8. Event-Driven Messaging System
9. Data Persistence Layer
10. Redis Caching Strategy
11. Dead Letter Queue Failure Handling
12. Complete Architecture Diagram
13. Execution Sequence Diagram
14. Repository Structure
15. Setup & Deployment
16. Running the System
17. Example Workflow
18. Observability & Logging
19. Security Considerations
20. Future Improvements

---

# 1. Overview

This repository demonstrates a **fully functional enterprise-style backend architecture**.

Instead of services communicating through synchronous API calls, they interact via **events and asynchronous queues**.

Benefits of this architecture:

* Loose coupling between services
* Improved scalability
* Fault tolerance
* Independent deployments
* Event replay capability
* Resilient distributed systems

---

# 2. Project Goals

This project aims to demonstrate:

* Breaking a **monolithic application** into **microservices**
* Implementing **event-driven architecture**
* Using **AWS messaging services**
* Building **CI/CD pipelines**
* Automating infrastructure provisioning
* Deploying containerized services

---

# 3. Technology Stack

## Backend

* Node.js
* Express.js
* JWT Authentication
* bcrypt password hashing

## Messaging & Event Bus

* AWS EventBridge
* AWS SQS
* Dead Letter Queues

## Infrastructure

* AWS EC2
* AWS DocumentDB
* AWS ElastiCache (Redis)
* AWS ECR
* AWS IAM
* AWS VPC

## DevOps

* Terraform
* Docker
* Docker Compose
* AWS CodePipeline
* AWS CodeBuild
* AWS CodeDeploy
* SonarQube

## Observability

* Structured JSON logging
* Correlation IDs

---

# 4. Microservices Overview

The system contains four independent services.

## API Gateway

Responsibilities:

* Entry point for all API requests
* Request routing
* Correlation ID generation
* Security middleware

Port:

```
8000
```

---

## Customer Service

Responsibilities:

* User signup/login
* Password hashing
* Customer management
* Linking orders to customers

Events Published

```
CustomerCreated
CustomerOrderLinked
```

Consumes

```
OrderCreated
```

Port

```
8001
```

---

## Products Service

Responsibilities:

* Product catalog management
* Inventory updates
* Redis cache invalidation

Events Published

```
ProductCreated
CacheInvalidated
```

Consumes

```
OrderCreated
CacheInvalidated
```

Port

```
8002
```

---

## Shopping Service

Responsibilities:

* Cart management
* Order processing

Events Published

```
OrderCreated
```

Consumes

```
CustomerCreated
```

Port

```
8003
```

---

# 5. CI/CD Pipeline Architecture

The system uses **AWS CodePipeline** for automated builds and deployments.

Pipeline stages:

```
GitHub
   ↓
CodePipeline
   ↓
CodeBuild (Tests + Change Detection)
   ↓
SonarQube Analysis
   ↓
Docker Build
   ↓
Push to Amazon ECR
   ↓
CodeDeploy
   ↓
EC2 Deployment
```

---

# 6. Intelligent Pipeline Optimization

The pipeline contains a **change detection mechanism**.

Instead of rebuilding everything on every push, it determines **which stages are necessary**.

This logic is implemented in:

```
scripts/detect_changes.sh
```

The script runs:

```
git diff --name-only HEAD~1
```

It generates:

```
pipeline.env
```

Example:

```
RUN_ANALYSIS=false
RUN_BUILD=true
RUN_DEPLOY=true
```

---

## Conditional Pipeline Execution

### Analysis Stage

```
if RUN_ANALYSIS=true
   run SonarQube
else
   skip analysis
```

### Build Stage

```
if RUN_BUILD=true
   build docker images
else
   reuse existing images
```

### Deploy Stage

```
if RUN_DEPLOY=true
   deploy application
else
   skip deploy
```

---

# 7. Docker Build Strategy

Each service builds a Docker image.

Images are tagged using:

```
service:commit_sha
service:latest
```

Example:

```
r2sqs-eb-customer:abc123
r2sqs-eb-customer:latest
```

Before building an image, the pipeline checks if it already exists in ECR.

```
aws ecr describe-images
```

If the image exists:

```
skip build
```

---

# 8. Deployment Workflow

Deployment is handled by **AWS CodeDeploy**.

CodeDeploy triggers:

```
scripts/deploy.sh
```

The script performs:

1. Detect AWS region
2. Login to ECR
3. Load image tag
4. Fetch secrets from AWS
5. Pull Docker images
6. Start containers using Docker Compose

```
docker compose down
docker compose pull
docker compose up -d
```

---

# 9. Runtime Infrastructure

Containers running on EC2:

```
gateway
customer
products
shopping
redis
sonarqube
```

Example container status:

```
docker ps
```

```
gateway
products
shopping
customer
redis
sonarqube
```

---

# 10. Data Persistence Layer

Persistent storage uses **Amazon DocumentDB**.

Collections:

```
customers
orders
products
carts
```

All services connect using TLS.

Example connection string:

```
mongodb://username:password@docdb-endpoint:27017
```

---

# 11. Redis Caching Strategy

The Products service caches product catalog data.

Workflow:

```
Redis
   ↓
Cache Hit → Return data
Cache Miss → Query DocumentDB
```

Cache invalidation is event driven.

```
ProductCreated
OrderCreated
```

trigger:

```
CacheInvalidated
```

---

# 12. Dead Letter Queue Handling

Each SQS queue has a DLQ.

```
Main Queue
   ↓
Retries
   ↓
Dead Letter Queue
   ↓
CloudWatch Alarm
   ↓
Engineer Alert
```

---

# 13. Complete Architecture Diagram

The following diagram represents the **complete enterprise CI/CD + event-driven architecture**.

```

[ 1. DEVELOPER & SOURCE CONTROL ]

---------------------------------

+------------------+         git push    +----------------------+
|    Developer     | ------------------> |      GitHub Repo     |
| (Edits Node.js / |                     | (Source of truth for |
|  TF / Docker)    |                     |  Code & Infra)       |
+------------------+                     +----------+-----------+
                                                    |
                                                    | Webhook Trigger
                                                    v

[ 2. AWS CODEPIPELINE: INTELLIGENT BUILD PIPELINE ]

---------------------------------------------------

+----------------------------------------------------------------------------------------------------------------------------------+
|                                                      AWS CODEPIPELINE                                                            |
|----------------------------------------------------------------------------------------------------------------------------------|
|                                                                                                                                  |
|  +-----------------------------------------------------+                                                                         |
|  |                 CODEBUILD STAGE                     |                                                                         |
|  |-----------------------------------------------------|                                                                         |
|  | Runs buildspec.yml                                  |                                                                         |
|  | 1. Checkout source                                  |                                                                         |
|  | 2. IMAGE_TAG = git commit SHA                       |                                                                         |
|  | 3. Run detect_changes.sh                            |                                                                         |
|  |                                                     |                                                                         |
|  | detect_changes.sh logic:                            |                                                                         |
|  |   git diff --name-only HEAD~1                       |                                                                         |
|  |   if backend code changed → RUN_BUILD=true          |                                                                         |
|  |   if Dockerfile changed → RUN_BUILD=true            |                                                                         |
|  |   if infra/config changed → RUN_DEPLOY=true         |                                                                         |
|  |   if only docs/scripts changed → skip stages        |                                                                         |
|  |                                                     |                                                                         |
|  | Output: pipeline.env (RUN_ANALYSIS, BUILD, DEPLOY)  |                                                                         |
|  +--------------------------+--------------------------+                                                                         |
|                             |                                                                                                    |
|                             v                                                                                                    |
|  +-----------------------------------------------------+                                                                         |
|  |        DECISION: SHOULD ANALYSIS RUN?               |                                                                         |
|  |-----------------------------------------------------|                                                                         |
|  | RUN_ANALYSIS = true ?                               |                                                                         |
|  |   YES → RUN SONARQUBE (Static Analysis / Security)  |                                                                         |
|  |   NO  → SKIP ANALYSIS                               |                                                                         |
|  +--------------------------+--------------------------+                                                                         |
|                             |                                                                                                    |
|                             v                                                                                                    |
|  +-----------------------------------------------------+           +----------------------------------------------------------+  |
|  |          DECISION: SHOULD BUILD RUN?                |           |                     PUSH TO ECR                          |  |
|  |-----------------------------------------------------|           |----------------------------------------------------------|  |
|  | RUN_BUILD = true ?                                  |   (YES)   | if image already exists in ECR → skip push               |  |
|  |   NO  → SKIP BUILD                                  |           | else → docker push                                       |  |
|  |   YES → DOCKER BUILD LOGIC                          | --------> |                                                          |  |
|  |         For each service (customer, products, etc.) |           | images tagged as:                                        |  |
|  |         Check if image exists in ECR:               |           |   service:commit_sha                                     |  |
|  |           aws ecr describe-images                   |           |   service:latest                                         |  |
|  |           if exists → SKIP BUILD                    |           +---------------------------+------------------------------+  |
|  |           else → docker build & docker tag          |                                       |                                 |
|  +-----------------------------------------------------+                                       |                                 |
|                                                                                                |                                 |
|  +---------------------------------------------------------------------------------------------+                                 |
|  |                                                                                                                               |
|  v                                                                                                                               |
|  +-----------------------------------------------------+                                                                         |
|  |         DECISION: SHOULD DEPLOY RUN?                |                                                                         |
|  |-----------------------------------------------------|                                                                         |
|  | RUN_DEPLOY = true ?                                 |                                                                         |
|  |   NO  → SKIP DEPLOY                                 |                                                                         |
|  |   YES → TRIGGER AWS CODEDEPLOY                      |                                                                         |
|  +--------------------------+--------------------------+                                                                         |
+-----------------------------|----------------------------------------------------------------------------------------------------+
                              |
                              v
[ 3. AWS CODEDEPLOY & DEPLOYMENT SCRIPT ]

-----------------------------------------

+--------------------------------------------------------------------------------------+
| AWS CODEDEPLOY (EC2 Agent)                                                           |
|--------------------------------------------------------------------------------------|
| Reads appspec.yml                                                                    |
| AfterInstall hook triggers → scripts/deploy.sh                                       |
|                                                                                      |
| deploy.sh Logic Execution:                                                           |
| 1. Detect AWS Region & Login to ECR                                                  |
| 2. Load IMAGE_TAG from image.env                                                     |
| 3. IF IMAGE_TAG exists in ECR → pull IMAGE_TAG                                       |
|    ELSE → pull latest                                                                |
| 4. Inject DB_URI / JWT_SECRET from AWS Secrets Manager / SSM                         |
| 5. docker compose down                                                               |
| 6. docker compose pull                                                               |
| 7. docker compose up -d                                                              |
| 8. Start containers: gateway, customer, products, shopping, redis, sonarqube         |
+--------------------------------------------------------------------------------------+
                              |
                              v



[ 4. RUNTIME SYSTEM (EC2 - Private Subnets) & API GATEWAY ]

-----------------------------------------------------------

+--------------------------------------------------------------------------------------+
|                                 API GATEWAY / NGINX                                  |
|                            (Container: r2sqs-eb-gateway)                             |
|                        (Generates uuidv4 Correlation IDs)                            |
|                                       |                                              |
+---------------+-----------------------+-----------------------+----------------------+
                |                       |                       |
                v                       v                       v
      +-------------------+   +-------------------+   +-------------------+
      | CUSTOMER SERVICE  |   | SHOPPING SERVICE  |   | PRODUCTS SERVICE  |
      | r2sqs-eb-customer |   | r2sqs-eb-shopping |   | r2sqs-eb-products |
      | (Auth, Users)     |   | (Carts, Checkout) |   | (Catalog, Cache)  |
      +---------+---------+   +---------+---------+   +---------+---------+
                |                       |                       |
      (Publishes CustomerCreated)  (Publishes OrderCreated) (Publishes CacheInvalidated)
                |                       |                       |
                v                       v                       v

[ 5. EVENT-DRIVEN BACKPLANE ]

-----------------------------

                           +---------------------------+
                           |     AMAZON EVENTBRIDGE    |
                           |       (Event Bus)         |
                           +-------------+-------------+
                                         |
               +-------------------------+-------------------------+
               |                         |                         |
               v                         v                         v
     +-------------------+    +-----------------------+    +-----------------------+
     | CustomerCreated   |    | OrderCreated Queue    |    | CacheInvalidated      |
     | Queue (SQS)       |    | & Prod Queue (Fan-Out)|    | Queue (SQS)           |
     +---------+---------+    +----------+------------+    +-----------+-----------+
               |                         |                             |
             (Poll)                 (Poll queues)                    (Poll)
               |                         |                             |
               v                         v                             v
      [ Shopping Service ]       [ Customer Service ]           [ Products Service ]
        creates cart             links order history              clears Redis key
                                         &
                                 [ Products Service ]
                                  reduces inventory


[ 6. DATA & CACHING LAYER ]

---------------------------

+-------------------------------------------+  +-------------------------------------------+
|             AMAZON DOCUMENTDB             |  |               REDIS CACHE                 |
| (Customer, Orders, Products collections)  |  |       (Products catalog caching)          |
| (Secured via TLS & VPC isolation)         |  |       (Event-driven invalidation)         |
+-------------------------------------------+  +-------------------------------------------+
       ^                           ^                  ^
       |                           |                  |
    (Reads/Writes)           (Reads/Writes)     (Reads/Purges)
[Customer/Shopping/Products] [Customer/Shopping] [Products Service]


[ 7. FAILURE HANDLING (DLQs) ]

------------------------------

+--------------------------------------------------------------------------------------+
| If a consumer crashes or DB locks during SQS processing:                             |
| SQS Retries → Dead Letter Queue (DLQ) → CloudWatch Alarm → Engineer Alert            |
+--------------------------------------------------------------------------------------+

```
---

# 14. Execution Sequence Diagram

Below is the **real execution flow captured from logs**.

```

[ 1. SYSTEM INITIALIZATION & CONTAINER BOOT (07:31:46) ]

--------------------------------------------------------

[ Docker Host ] 
      |
      |--> (Spins up containers via docker-compose)
      |
      |--> [ Customer Container ] ---> "Customer service listening" (Port 8001)
      |         |--> "Connected to DocumentDB"
      |         |--> "Starting SQS Consumer" (r2sqs-eb-order-created-queue)
      |
      |--> [ Products Container ] ---> "Products service listening" (Port 8002)
      |         |--> "Connected to DocumentDB"
      |         |--> "Starting SQS Consumer" (r2sqs-eb-order-created-products-queue)
      |         |--> "Starting SQS Consumer" (r2sqs-eb-cache-invalidated-queue)
      |         |--> "Cache Miss — querying DB" (cacheKey: products:all) ---> (Initial Cache Load)
      |
      |--> [ Shopping Container ] ---> "Shopping service listening" (Port 8003)
      |         |--> "Connected to DocumentDB"
      |         |--> "Starting SQS Consumer" (r2sqs-eb-customer-created-queue)


[ 2. USER SIGNUP FLOW: EVENT PUBLISHING & CART CREATION (07:35:20) ]

--------------------------------------------------------------------

[ Client Request ] 
      |
      |---> POST /signup (email: user1@test.com) ---> [ API Gateway ] ---> [ Customer Service ]
                                                                                |
                                                                                |--> "Customer Signed Up" (ID: 69afc9b8...)
                                                                                |--> "Publishing Event" (CustomerCreated)
                                                                                |
[ Customer Service ] -----------------(CustomerCreated Event)-----------------> [ AWS EventBridge ]
      |                                                                                 |
      |--> "EventBridge ACK received"                                                   |
                                                                             (Routes via Rule 1)
                                                                                        |
                                                                                        v
                                                                        [ r2sqs-eb-customer-created-queue (SQS) ]
                                                                                        |
                                                                                      (Poll)
                                                                                        |
                                                                                        v
                                                                              [ Shopping Service ]
                                                                                        |--> "SQS Message Received"
                                                                                        |--> "Processing Event" (CustomerCreated)
                                                                                        |--> "Cart Created" (For ID: 69afc9b8...)
                                                                                        |--> "SQS Message Deleted"

[ 3. USER LOGIN (07:35:24) ]

----------------------------

[ Client Request ] ---> POST /login (email: user1@test.com) ---> [ Customer Service ]
                                                                      |--> "Customer Signed In"


[ 4. PRODUCT CREATION & EVENT-DRIVEN CACHE INVALIDATION (07:36:01) ]

--------------------------------------------------------------------

[ Client Request ] ---> POST /product/create (Name: Flour, Type: Grocery) ---> [ Products Service ]
                                                                                      |
                                                                                      |--> "Product Created" (ID: 69afc9e1...)
                                                                                      |--> "Publishing Event" (ProductCreated)
                                                                                      |
[ Products Service ] ----------------(ProductCreated Event)---------------------> [ AWS EventBridge ]
      |                                                                                 |
      |--> "EventBridge ACK received"                                             (External routing/logging)
      |
      |--> "Publishing Event" (CacheInvalidated)
      |
[ Products Service ] ----------------(CacheInvalidated Event)-------------------> [ AWS EventBridge ]
      |                                                                                 |
      |--> "EventBridge ACK received"                                            (Routes via Rule 3)
      |--> "CacheInvalidated event published"                                           |
                                                                                        v
                                                                        [ r2sqs-eb-cache-invalidated-queue (SQS) ]
                                                                                        |
                                                                                      (Poll)
                                                                                        |
                                                                                        v
                                                                              [ Products Service ]
                                                                                        |--> "SQS Message Received"
                                                                                        |--> "Processing Event" (CacheInvalidated)
                                                                                        |--> "Cache Cleared" (key: products:all)
                                                                                        |--> "SQS Message Deleted"
                                                                                        |
                                                                                        |--> (Subsequent query)
                                                                                        |--> "Cache Miss — querying DB" (Reloads cache)


[ 5. CART UPDATE (07:36:19) ]

-----------------------------

[ Client Request ] ---> Add to Cart (Product: Flour, QTY: 250) ---> [ Shopping Service ]
                                                                            |--> "Cart Updated"


[ 6. ORDER CREATION & FAN-OUT TO CUSTOMER + PRODUCTS (07:36:32) ]

-----------------------------------------------------------------

[ Client Request ] ---> POST /order ---> [ Shopping Service ]
                                                |
                                                |--> "Order Created" (ID: 69afca00...)
                                                |--> "Publishing Event" (OrderCreated)
                                                |
[ Shopping Service ] ----------------(OrderCreated Event)----------------------> [ AWS EventBridge ]
      |                                                                                  |
      |--> "EventBridge ACK received"                                             (Routes via Rule 2)
                                                                               (FAN-OUT PATTERN TRIGGERED)
                                                                                         |
                                      +--------------------------------------------------+-------------------------------------------------+
                                      |                                                                                                    |
                                      v                                                                                                    v
                  [ r2sqs-eb-order-created-queue (SQS) ]                                                            [ r2sqs-eb-order-created-products-queue (SQS) ]
                                      |                                                                                                    |
                                    (Poll)                                                                                               (Poll)
                                      |                                                                                                    |
                                      v                                                                                                    v
                             [ Customer Service ]                                                                                 [ Products Service ]
                                      |--> "SQS Message Received"                                                                          |--> "SQS Message Received"
                                      |--> "Processing Event" (OrderCreated)                                                               |--> "Processing Event" (OrderCreated)
                                      |--> "Order Linked to Customer"                                                                      |--> "Publishing Event" (CacheInvalidated)
                                      |                                                                                                    |--> "Inventory Reduced" (Product: Flour, QTY: 250)
                                      |--> "Publishing Event" (CustomerOrderLinked) --> (To EventBridge)                                   |
                                      |--> "EventBridge ACK received"                                                                      |--> (CacheInvalidation Flow executes again)
                                      |--> "SQS Message Deleted"                                                                           |     |--> Publishes CacheInvalidated to EventBridge
                                                                                                                                           |     |--> Receives ACK
                                                                                                                                           |     |--> Receives payload from cache-invalidated SQS
                                                                                                                                           |     |--> "Cache Cleared" (products:all)
                                                                                                                                           |     |--> Deletes SQS message
                                                                                                                                           |
                                                                                                                                           |--> "SQS Message Deleted" (From order-created-products-queue)


[ 7. SECOND PRODUCT CREATION & CACHE INVALIDATION (07:37:32) ]

--------------------------------------------------------------

[ Client Request ] ---> POST /product/create (Name: Laptop, Type: Electronics) ---> [ Products Service ]
                                                                                            |
                                                                                            |--> "Product Created"
                                                                                            |--> "Publishing Event" (ProductCreated)
                                                                                            |--> "Publishing Event" (CacheInvalidated)
                                                                                            |--> (EventBridge Routes to SQS)
                                                                                            |--> (Consumer pulls from SQS)
                                                                                            |--> "Cache Cleared"
                                                                                            |--> "Cache Miss — querying DB" (Reloads cache)


[ 8. SECOND CART UPDATE & ORDER CREATION FAN-OUT (07:38:15 - 07:38:34) ]

------------------------------------------------------------------------

[ Client Request ] ---> Add to Cart (Product: Laptop, QTY: 8) ---> [ Shopping Service ] --> "Cart Updated"
      |
[ Client Request ] ---> POST /order ---> [ Shopping Service ]
                                                |
                                                |--> "Order Created" (ID: 69afca7a...)
                                                |--> "Publishing Event" (OrderCreated)
                                                |
[ Shopping Service ] ----------------(OrderCreated Event)----------------------> [ AWS EventBridge ]
      |                                                                                  |
      |--> "EventBridge ACK received"                                             (Routes via Rule 2)
                                                                               (FAN-OUT PATTERN TRIGGERED)
                                                                                         |
                                      +--------------------------------------------------+-------------------------------------------------+
                                      |                                                                                                    |
                                      v                                                                                                    v
                  [ r2sqs-eb-order-created-queue (SQS) ]                                                            [ r2sqs-eb-order-created-products-queue (SQS) ]
                                      |                                                                                                    |
                                    (Poll)                                                                                               (Poll)
                                      |                                                                                                    |
                                      v                                                                                                    v
                             [ Customer Service ]                                                                                 [ Products Service ]
                                      |--> "SQS Message Received"                                                                          |--> "SQS Message Received"
                                      |--> "Processing Event" (OrderCreated)                                                               |--> "Processing Event" (OrderCreated)
                                      |--> "Order Linked to Customer"                                                                      |--> "Publishing Event" (CacheInvalidated)
                                      |--> "Publishing Event" (CustomerOrderLinked)                                                        |--> "Inventory Reduced" (Product: Laptop, QTY: 8)
                                      |--> "SQS Message Deleted"                                                                           |
                                                                                                                                           |--> (CacheInvalidation Flow executes again)
                                                                                                                                           |     |--> "Cache Cleared"
                                                                                                                                           |
                                                                                                                                           |--> "SQS Message Deleted"
```
---

# 15. Repository Structure

```
customer/
products/
shopping/
gateway/

shared/
scripts/

infrastructure/

docker-compose.yml
buildspec.yml
appspec.yml
```

---

# 16. Running the System

```
docker compose up -d
```

Check containers:

```
docker ps
```

---

# 17. Example API Flow

Signup:

```
POST /signup
```

Create product:

```
POST /product/create
```

Create order:

```
POST /order
```

---

# 18. Observability

Logs include correlation IDs.

Example:

```
{
 "service":"customer",
 "event":"CustomerCreated",
 "correlationId":"abc123"
}
```

---

# 19. Security

Security features include:

* IAM roles
* Secrets Manager
* TLS connections
* JWT authentication

---

# 20. Future Improvements

Possible enhancements:

* Kubernetes deployment
* Distributed tracing
* Metrics dashboards
* Canary deployments
* Blue-green deployments

---

# Conclusion

This project demonstrates a **complete cloud-native microservices platform**, including:

* Event-driven architecture
* Automated CI/CD
* Infrastructure as Code
* Container orchestration
* Distributed caching
* Secure secrets management

It provides a **practical reference architecture for modern scalable backend systems**.

---
