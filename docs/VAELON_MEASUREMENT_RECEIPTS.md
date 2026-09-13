# VÆLON measurement receipts

Measurement receipts provide a stable diagnostic record around the maintained runtime optimization contract. They preserve explicit problem identity, provider identity, solver metadata, objective, decision vector, and elapsed duration.

They are not replay records and are not application truth. A provider result is validated before measurement is emitted, keeping malformed computation from crossing the runtime boundary.
