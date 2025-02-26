# 流计算系统比较

## Streams, joins and temporal tables
https://docs.google.com/document/d/1RvnLEEQK92axdAaZ9XIU5szpkbGqFMBtzYiIY4dHe0Q/edit?pli=1#heading=h.7fd469pi266d

## Flink/RisingWave

## Jet



## MillWheel

* per-key state。string - bytes
* low watermark：所有compute中timestamp去最小值，中心节点收集并广播。会持久化。
* 提供timer/state API，并且MW保证是幂等的。访问外部系统需要用户保证幂等。
* 事件到达后会先写log，由low watermark来触发。
* compute可以任意增删。
* 重启后，所有record会先dedup再执行，确保exactly-once。执行了一遍但没有commit的状态变化因为是幂等的，所以再执行一遍没有关系。

### 步骤：
Upon receipt of an input record for a computation, the MillWheel framework performs the following steps:

* The record is checked against deduplication data from previous deliveries; duplicates are discarded.
* User code is run for the input record, possibly resulting in pend-ing changes to timers, state, and productions. # 所有修改会形成pending-changes, 包括发送给下游的records
* Pending changes are committed to the backing store. # 原子性地提交修改
Senders are ACKed. # 告诉sender OK
* Pending downstream productions are sent. # 向下游发送records.

https://dirtysalt.github.io/html/millwheel.html

## Differential Dataflow

