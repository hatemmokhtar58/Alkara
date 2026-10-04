# Build context: the repository root (see deploy/docker-compose.yml)
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY api/api.csproj api/nuget.config api/
RUN dotnet restore api/api.csproj
COPY api/ api/
RUN dotnet publish api/api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "api.dll"]
