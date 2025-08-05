const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'TANCAT API',
            version: '1.0.0',
            description: 'Sistema de Administración para Complejo Deportivo TANCAT'
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 3000}/api`,
                description: 'Servidor de Desarrollo'
            }
        ]
    },
    apis: ['./routes/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = {
    specs,
    swaggerUi,
    swaggerOptions: {
        explorer: true
    }
};