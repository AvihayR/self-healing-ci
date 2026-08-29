# Canary

## What it is

An uptime monitor. You register URLs, a scheduled probe pings them, and a dashboard shows
current status, response-time history and rolling availability.

## Who it is for

One person: the developer running `self-healing-ci`. There are no accounts, no teams and
no tenancy, and there will not be. Canary exists to be broken on purpose so a Claude agent
can be drilled at diagnosing CI failures, and every hour spent on product features is an
hour not spent on the pipeline that is the actual subject.

## What it must be able to do

- Register a URL to watch, and stop watching it.
- Show, for every monitor, whether it is up right now and when it was last checked.
- Show response-time history bucketed over 24h, 7d or 30d.
- Show rolling availability over the same windows.
- Answer a health check used by the deploy smoke test.

## What it deliberately does not do

No authentication, no multi-tenancy, no pagination, no incident management, no on-call.
Notification is handled by OpenSearch Alerting as configuration, not by application code.

## Product truths that constrain design

- **Unmeasured is not healthy.** A monitor with no checks has `null` availability, never
  100%. A probe that failed to connect has `null` latency, never 0. The interface must
  never let missing data read as good news — that is the exact failure mode the wider
  project exists to catch, and a dashboard that rounds it away would be arguing against
  its own thesis.
- **All time is epoch milliseconds, UTC.** Nothing in the interface should imply a local
  timezone it has not actually converted.
- **The data model is buckets, not a curve.** History arrives as discrete buckets with
  counts and percentiles. Drawing it as a smooth line would be a claim the data does not
  support.

## Where it is seen

It gets showcased — shown to other people as a finished thing, in screenshots and on a
screen. It is not an ops console someone stares at for eight hours. It has to survive
being looked at directly.
