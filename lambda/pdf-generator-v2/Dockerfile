FROM public.ecr.aws/lambda/nodejs:20

RUN dnf install -y \
    atk \
    cups-libs \
    gtk3 \
    libXcomposite \
    libXdamage \
    libXrandr \
    libXtst \
    pango \
    alsa-lib \
    at-spi2-atk \
    libxkbcommon \
    nss \
    && dnf clean all

COPY package*.json ./
RUN npm ci

COPY index.js ./
COPY lib/ ./lib/
COPY template/ ./template/

CMD ["index.handler"]
