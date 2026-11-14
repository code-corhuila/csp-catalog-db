# Liquibase with MongoDB support. It takes TWO packages, and the names mislead:
#   liquibase-mongodb  the extension: teaches Liquibase the mongodb:// protocol
#   mongodb            the Java driver the extension needs to connect
# Installing only `mongodb` looks like it worked and fails with
# "Driver class was not specified and could not be determined from the url".
# The versions are fixed (Annex G): Liquibase 4.29.2, the extension 4.29.1 and the Java driver 3.12.14 that `mongodb` installs.
FROM liquibase/liquibase:4.29.2
RUN lpm add liquibase-mongodb@4.29.1 mongodb@3.12.14 --global
