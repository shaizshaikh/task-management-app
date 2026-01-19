# ArgoCD Installation Guide and aks setup infra
## Create the ArgoCD and task management Namespaces

kubectl create namespace task-management
kubectl create namespace argocd

##command for installing the ingress controler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

##command for installing the ssl cert
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

## Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

## Wait for ArgoCD Pods to Become Ready
kubectl get pods -n argocd


## Step 4: Retrieve the Admin Password
###powershell and bash commands
bash command:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
powershell command:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | %{[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_))}
Save this password.

Login credentials:

* Username: `admin`
* Password: retrieved value


## Step 5: Access the ArgoCD UI (Port Forwarding)

Start port forwarding to access the ArgoCD UI.

Open a new terminal and run:

kubectl port-forward svc/argocd-server -n argocd 8080:80

url: localhost:8080
password:retrieved value 

