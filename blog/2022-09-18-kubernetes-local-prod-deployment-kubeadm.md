---
slug: kubernetes-local-prod-deployment-kubeadm
title: Kubernetes local deployment using Kubeadm
author: NomanAziz
author_title: DevSecOps Engineer
author_url: https://linkedin.com/in/noman-aziz
author_image_url: /img/nomanaziz2.jpeg
image: /bgimg/kubernetes-logo.webp
tags: [Docker, K8, DevOps]
---

import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Giscus from "@giscus/react";

Kubernetes is an open-source container orchestration tool developed by Google which helps you manage containerized applications in different deployment environments like physical, virtual, cloud or hybrid etc.

When I was learning Kubernetes, almost every tutorial I saw made the use of minikube for deployment and I followed it at the time. Later on, when I wanted to test things in a production environment, I found no tutorial which covered all the aspects of self-deployment of k8 which led me to test various things on my own and write this article.

<!--truncate-->

## Environment

Setup was done on Proxmox with 3 virtual machines. One for the master node and the rest two for worker nodes. Each machine is running Ubuntu Server 20.04 with CPU type set as Host (fixes errors relating docker containers).

## Installing pre-requisites

These steps need to be performed on all the nodes.

1. First Docker is installed.

```sh
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

2. Then a [Container Runtime](https://kubernetes.io/docs/setup/production-environment/container-runtimes) was required so I installed [cri-dockerd](https://github.com/Mirantis/cri-dockerd) by following the instructions mentioned on Github.

3. Then, to set up K8 cluster, I chose to install Kubeadm by following the [docs](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/). Other options are Kubeops and Kubespray but they have their own separate use cases as mentioned [here](https://www.altoros.com/blog/a-multitude-of-kubernetes-deployment-tools-kubespray-kops-and-kubeadm/).

## Setting up the cluster

I set up a [control-plane](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/) on the master node to initialize the cluster using the following command.

```sh
sudo kubeadm init --pod-network-cidr=10.244.0.0/16 --cri-socket=unix:///var/run/cri-dockerd.sock
```

Pod network is specified here to avoid errors regarding cidr while setting up the network later on. This command outputs certain instructions which must be noted for the worker nodes to join the cluster later on.

## Setting up the network

On all the nodes, a [Pod Network Add-on](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/#pod-network) should be installed for the networking to take place. [Flannel](https://github.com/flannel-io/flannel) was chosen among the others since there were no special requirements for the network settings and this was the simplest to set up among the rest.

In order to set up Flannel, first, download its release binary on all the nodes and place it in `/opt/bin/flanneld`. Then, on the master node, apply the flannel deployment using the following command

```
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

Finally, verify that the CoreDNS service is running using `kubectl get pods --all-namespaces`.

## Join other nodes

Now, after the network is all set up, run the command that you noted while setting up the cluster in order to make the worker nodes join the cluster. Verify on the master node about other nodes joining status using `kubectl get nodes`.

## Setting up the dashboard

We can set up a [dashboard](https://kubernetes.io/docs/tasks/access-application-cluster/web-ui-dashboard/) that allows us to view all the components in the k8 cluster via a web user interface. I applied the following YAML manifest file to deploy the dashboard.

```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.6.1/aio/deploy/recommended.yaml
```

After that, I created a sample user account with admin privileges by following this [guide](https://github.com/kubernetes/dashboard/blob/master/docs/user/access-control/creating-sample-user.md).

### Accessing the dashboard

After setting up the dashboard, I could not access the dashboard from any other machine mainly due to the service type of dashboard being ClusterIP and even after I port forwarded the local address, I could not access it due to lack of SSL/TLS. I followed [this](https://adamtheautomator.com/kubernetes-dashboard/) guide to access the dashboard.

```sh
// change the type of service from ClusterIP to NodePort
$ kubectl edit service/kubernetes-dashboard -n kubernetes-dashboard

// get name of dashboard pod
$ kubectl get pods --all-namespaces

// delete dashboard pod since whenever you modify the service type, you must delete the pod
$ kubectl delete pod <dashboard-pod-name> -n kubernetes-dashboard

// Verify the kubernetes-dashboard service has the correct type
$ kubectl get svc --all-namespaces
```

The dashboard will be accessible at `https://ip:nodePort` and a login token will be needed every time for authentication which can be gotten by running the following command.

```sh
kubectl -n kubernetes-dashboard create token admin-user
```

## Setting up a local load balancer

Since this is a local deployment, a [bare metal load balancer](https://kubernetes.github.io/ingress-nginx/deploy/baremetal/) is required to expose the services on the internet. There is no official k8 support for this matter, but there exists a third-party solution [MetalLB](https://metallb.universe.tf/) to solve this issue. Note that this is still a beta product and problems can be expected to arise in the long term.

We can install MetalLB by following the manifest file method mentioned in their [docs](https://metallb.universe.tf/installation/). After this, install IPAddressPool resource and L2Advertisement inside the metallb namespace as described [here](https://metallb.universe.tf/configuration/).

## Setting up Nginx ingress controller

After setting up the load balancer, an ingress controller is required to route all the traffic from the load balancer to the respective services. I selected Nginx as my ingress controller and installed it using helm by following their official [guide](https://kubernetes.github.io/ingress-nginx/deploy/#quick-start).

After deploying the ingress controller, we can confirm that the load balancer is working correctly by checking that an external IP address is assigned to it using `kubectl get all -n ingress-nginx`

## Deploying an application

I am deploying mongo express along with mongo-db as a sample application. The whole source code can be found on my [Github repo](https://github.com/Noman-Aziz/Kubernetes-101).

### Applying resource quotas

Namespaces should be used whenever possible to organize things. Another advantage of namespaces is applying resource quotas which can help to prioritize certain things like you want the testing department namespace to consume less resources than the production namespace. Following [guide](https://kubernetes.io/docs/tasks/administer-cluster/manage-resources/quota-memory-cpu-namespace/) can help you to set resource quotas on namespaces and deployments. 

### Using local persistent volumes

This part was a headache for me since I wanted to use local storage. First of all, local Persistent Volumes on disk are not supported by K8. The only way it works is that the pod will be running on the same node on which the volume is created. Hence, I used NFS for my local deployment. 

Another thing to keep in mind is to use StatefulSet instead of Deployments. In deployment, if there is only 1 replica then it can work, in the case of scaling ( > 1 replicas ), we will get an error that our volume is already in use when a pod starts on another node. Even if that is not the case, and both pods end up on the same node, still they will write to the same volume.

It should be noted that it is okay to use deployments in the case of Read-Only Volumes.

#### Creating a persistent volume (PV)

NFS server utils package is installed on the node hosting the NFS server and the NFS client utils package is installed on all the worker nodes. The following manifest file is used to deploy a PV, it should be noted that PV can not be namespaced.

:::tip
If you want to know which resources can be namespaced or not, you can issue the following command `kubectl api-resources --namespaced=false`
:::

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongo-pv
spec:
  capacity:
    storage: 1Gi
  volumeMode: Filesystem
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  nfs:
    path: /srv/nfs/data
    server: 192.168.88.96
```

#### Creating a persistent volume claim (PVC)

PVC is required to claim a persistent volume. It is created in the same namespace as the resource utilizing it. The following manifest file was used to set up the PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongo-pvc
  namespace: local-testing
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  volumeName: mongo-pv
  resources:
    requests:
      storage: 1Gi
```

#### Using PVC in StatefulSet of MongoDB

This is how we use a PVC in a manifest file of a StatefulSet.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongo-db
  namespace: local-testing
spec:
  selector:
    matchLabels:
      app: mongodb
  serviceName: mongodb-service
  replicas: 1
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      volumes:
        - name: mongo-data
          persistentVolumeClaim:
            claimName: mongo-pvc
      containers:
        - name: mongodb
          image: mongo
          ports:
            - containerPort: 27017
		  # envs
          volumeMounts:
            - mountPath: /data/db
              name: mongo-data
      restartPolicy: Always
```

We specify our PVC in the volumes section and use the volume inside a container via the volumeMounts tag.

## Exposing an app using ingress

I wrote the following ingress file to expose mongo express on a custom domain. Note that DNS records should be set up separately using your domain provider settings.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mongo-express-ingress
  namespace: local-testing
spec:
  ingressClassName: nginx
  rules:
    - host: mongo-express.nomanaziz.me
      http:
        paths:
          - pathType: Prefix
            backend:
              service:
                name: mongo-express-service
                port:
                  number: 8081
            path: /
```

After applying this, you should be able to visit your domain and see mongo express being deployed and running.

## Setting up certificate management

I used Cert-Manager to install free certificates on my domain using the lets-encrypt service. I followed an article on [DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-set-up-an-nginx-ingress-on-digitalocean-kubernetes-using-helm#step-4-securing-the-ingress-using-cert-manager) to setup certificates. The steps are described below.

```sh
// Create a namespace for cert-manager
$ kubectl create namespace cert-manager

// Add helm repo for it
$ helm repo add jetstack https://charts.jetstack.io

// Update Helm repos
$ helm repo update

// Install package using helm
$ helm install cert-manager jetstack/cert-manager --namespace cert-manager --set installCRDs=true
```

Next, apply this manifest file to use cert-manager along with our nginx ingress

```yaml
	apiVersion: cert-manager.io/v1
	kind: ClusterIssuer
	metadata:
	  name: letsencrypt-prod
	spec:
	  acme:
		# Email address used for ACME registration
		email: your@email.com
		server: https://acme-v02.api.letsencrypt.org/directory
		privateKeySecretRef:
		  # Name of a secret used to store the ACME account private key
		  name: letsencrypt-prod-private-key
		# Add a single challenge solver, HTTP01 using nginx
		solvers:
		  - http01:
			  ingress:
				class: nginx
```

Finally update the mongo express ingress file to include TLS certificates

```yaml
apiVersion: networking.k8s.io/v1
	kind: Ingress
	metadata:
	  name: mongo-express-ingress
	  namespace: local-testing
	  annotations:
		cert-manager.io/cluster-issuer: "letsencrypt-prod"
	spec:
	  ingressClassName: nginx
	  tls:
		- hosts:
			- mongo-express.nomanaziz.me
		  secretName: mongo-express-certificate
	  rules:
		- host: mongo-express.nomanaziz.me
		  http:
			paths:
			  - pathType: Prefix
				backend:
				  service:
					name: mongo-express-service
					port:
					  number: 8081
				path: /
```

## Closing remarks

This is not the perfect local deployment structure of Kubernetes, many things can be improved here. I am open to any suggestions in the comments section.

<br/>
<h2>Comments</h2>
<Giscus
id="comments"
repo="Noman-Aziz/Blogs"
repoId="R_kgDOIAF3tw"
category="General"
categoryId="DIC_kwDOIAF3t84CRfxZ"
mapping="title"
term="Comments"
reactionsEnabled="1"
emitMetadata="0"
inputPosition="top"
theme="preferred_color_scheme"
lang="en"
loading="lazy"
crossorigin="anonymous"
    />