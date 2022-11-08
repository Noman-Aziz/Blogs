---
title: ELK alerts for Discord via reverse webhook Proxy
---

### Problem

So you have to send alerts to discord when an event is triggered like a host's disk usage is above 80%. The problem is that ELK does not natively integrate discord webhooks.

### Solution

You can follow the mentioned procedure to integrate discord webhooks with ELK

### Creating an Elastic Discord Webhook Proxy

Since Discord Webhooks do not have native integration with Kibana, hence I set up a reverse proxy server that accepts alerts from Kibana and forwards them to Discord via its hook.

- On a separate server, clone the [Github Repo](https://github.com/captainGeech42/elastic-discord-webhook-proxy)
- Copy the `config.ex.json` file to your current directory as `config.json`
- Update the WebhookURL field with a Discord webhook URL
- I edited the `types.go` file according to the requirements of the alert
   - ![Image1](https://res.cloudinary.com/dy09028kh/image/upload/v1667905568/1zxuRES_fnxgyz.png)
- Similarly, i edited main.go file to include custom messages and formatting
   - ![Image2](https://res.cloudinary.com/dy09028kh/image/upload/v1667905682/SYj29pm_kzdykm.png)
- Then i compiled the files into a binary using command
   - `go build main.go tools.go`
- Finally, i created a system startup script for the reverse proxy server to start on bootup ([Reference](https://askubuntu.com/questions/1365334/how-to-run-a-process-binary-on-system-startup-reboot-in-ubuntu-20-04-lts))
- Since this was hosted on a local server and Kibana was managed by GCP, we forwarded the port 8080 to external port 8088

### Creating a Connector in Kibana

- On Kibana Dashboard, navigate to **Stack Management** => **Connectors**
   - ![Image3](https://res.cloudinary.com/dy09028kh/image/upload/v1667905903/35AgVgk_wywwtl.png)
- Add a new connector with its configuration as follows
   - ![Image4](https://res.cloudinary.com/dy09028kh/image/upload/v1667905950/qlJWUxO_iarawu.png)

### Creating a Rule in Kibana

- After creating the connector, head over to the rules tab
   - ![Image5](https://res.cloudinary.com/dy09028kh/image/upload/v1667907680/3t3m9rT_bfrtb1.png)
- Next, create a new rule with its configuration as follows
   - ![Image6](https://res.cloudinary.com/dy09028kh/image/upload/v1667907772/tZp00fo_i0ozxd.png)
      - Give the Rule a Name like in the example is for CPU Usage
      - “Check every” field means that this rule will be checked every 10 minutes
      - “Notify” field means the alert notification will be sent each time the rule’s condition is triggered

   - ![Image7](https://res.cloudinary.com/dy09028kh/image/upload/v1667907863/kR229c9_i38gtn.png)
      - Choose the rule type as inventory since we are applying the rule on the host machines which are present in the inventory

   - ![Image8](https://res.cloudinary.com/dy09028kh/image/upload/v1667907963/IP6y4ze_o46cbg.png)
      - Choose Hosts as For
      - Choose the Metric you want to measure in WHEN
      - Add Alert & Warning (Optional) Condition in `IS ___` Section

   - ![Image9](https://res.cloudinary.com/dy09028kh/image/upload/v1667908000/VWPOqnU_viyc25.png)
      - Next, we will add 3 connectors i.e the Connector that we created earlier, choose Webhook in connector type

   - ![Image10](https://res.cloudinary.com/dy09028kh/image/upload/v1667908139/TYRX8eP_zxykav.png)
      - This is First Connector
      - Its body contains the following rules
      - ```json
        {
         "alertId": "{{rule.id}}",
         "alertName": "{{rule.name}}",
         "spaceId": "{{rule.spaceId}}",
         "tags": "{{rule.tags}}",
         "alertInstanceId": "{{alert.id}}",
         "reason": "{{context.reason}}",
         "value": "{{context.value.condition0}}",
         "metric": "{{context.metric.condition0}}",
         "triggeredAt": "{{context.timestamp}}",
         "status": "critical"
        }
        ```

   - ![Image11](https://res.cloudinary.com/dy09028kh/image/upload/v1667908188/zYvv0Wb_inugg6.png)
      - This is Second Connector
      - Its body contains the following rules
      - ```json
        {
         "alertId": "{{rule.id}}",
         "alertName": "{{rule.name}}",
         "spaceId": "{{rule.spaceId}}",
         "tags": "{{rule.tags}}",
         "alertInstanceId": "{{alert.id}}",
         "reason": "{{context.reason}}",
         "value": "{{context.value.condition0}}",
         "metric": "{{context.metric.condition0}}",
         "triggeredAt": "{{context.timestamp}}",
         "status": "warning"
        }
        ```

   - ![Image12](https://res.cloudinary.com/dy09028kh/image/upload/v1667908225/xvEVCeK_sshz0i.png)
      - This is Third Connector
      - Its body contains the following rules
      - ```json
        {
         "alertId": "N/A",
         "alertName": "{{rule.name}}",
         "spaceId": "N/A",
         "tags": "{{rule.tags}}",
         "alertInstanceId": "{{alert.id}}",
         "reason": "Resolved",
         "value": "N/A",
         "metric": "N/A",
         "triggeredAt": "N/A",
         "status": "resolved"
        }
        ```

- Finally save the rule and it will be active, you will start receiving trigger alerts of different types on the Discord channel.

### Reference Docs

- <a href="https://www.elastic.co/guide/en/kibana/8.2/alerting-getting-started.html#alerting-concepts-alerts" target="_blank"> https://www.elastic.co/guide/en/kibana/8.2/alerting-getting-started.html#alerting-concepts-alerts</a>
- <a href="https://www.elastic.co/guide/en/kibana/8.2/webhook-action-type.html" target="_blank"> https://www.elastic.co/guide/en/kibana/8.2/webhook-action-type.html</a>
- <a href="https://www.elastic.co/guide/en/kibana/8.2/create-and-manage-rules.html#defining-rules-actions-details" target="_blank"> https://www.elastic.co/guide/en/kibana/8.2/create-and-manage-rules.html#defining-rules-actions-details</a>
