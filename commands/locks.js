const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'locks', // Nombre del comando: !locks
    description: 'Muestra los canales bloqueados SOLO en este servidor.',
    async execute(client, message, args, { lockedChannels, paginationStates, generatePaginationButtons }) {
        // Solo administradores pueden usar este comando
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ ¡No tienes los permisos para usar este comando!');
        }

        try {
            // Filtrar solo canales que existen en el Gremio/Servidor actual
            const lockedList = Array.from(lockedChannels.entries())
                .map(([id, data]) => {
                    // Busca el canal usando el caché del Gremio actual (message.guild.channels.cache)
                    const channel = message.guild.channels.cache.get(id); 
                    return channel ? {
                        id,
                        channelName: channel.name,
                        pokemon: data.pokemon || 'Desconocido',
                        type: data.type === 'private' ? 'Privado' : 'Público'
                    } : null;
                })
                .filter(item => item !== null) // Eliminar los canales que no pertenecen a este servidor
                .sort((a, b) => a.pokemon.localeCompare(b.pokemon));

            if (lockedList.length === 0) {
                return message.reply('❌ No hay canales bloqueados actualmente en este servidor.');
            }

            const itemsPerPage = 5;
            const totalPages = Math.ceil(lockedList.length / itemsPerPage);
            const prefix = 'locks_'; // Prefijo para los botones de paginación

            const generateEmbed = (currentPage) => {
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const currentItems = lockedList.slice(start, end);

                const embed = new EmbedBuilder()
                    .setColor(0xEE82EE) // Un color distinto, como el violeta
                    .setTitle(`📋 Canales Bloqueados Localmente (${lockedList.length})`)
                    .setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });

                embed.setDescription(
                    currentItems.length === 0 
                        ? 'No hay canales bloqueados en esta página.'
                        : currentItems.map(item => 
                            `🔒 **${item.pokemon}** (Canal #${item.channelName})\n` +
                            `• Tipo: ${item.type}\n` +
                            `• [Ir al Canal](https://discord.com/channels/${message.guild.id}/${item.id})`
                          ).join('\n\n')
                );

                return embed;
            };
            
            const initialState = { 
                currentPage: 0,
                lockedList,
                itemsPerPage,
                totalPages,
                messageAuthorId: message.author.id,
                commandName: 'locks', // Nombre del nuevo comando
                customPrefix: prefix
            };
            const reply = await message.reply({ 
                embeds: [generateEmbed(initialState.currentPage)], 
                components: [generatePaginationButtons(initialState.currentPage, totalPages, prefix)],
                fetchReply: true
            });

            paginationStates.set(reply.id, initialState);
        } catch (error) {
            console.error('❌ Error en comando locks:', error);
            message.reply('❌ Ocurrió un error al mostrar la lista de bloqueos del servidor.');
        }
    },
    
    // Función de manejo de paginación (igual que el original, pero con el nuevo prefijo)
    handlePagination: async (interaction, state, generatePaginationButtons, paginationStates) => {
        if (!interaction.customId.startsWith(state.customPrefix)) return;
        
        // Verificar si la interacción ha expirado (usando la lógica de tu index.js)
        if (!paginationStates.has(interaction.message.id)) {
            return interaction.update({
                components: [], // Eliminar botones
                content: '⌛ Esta interacción ha expirado (1 minuto)',
                embeds: []
            }).catch(() => {});
        }

        if (state.messageAuthorId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ Solo el autor del comando puede interactuar con esta paginación.',
                ephemeral: true
            });
        }

        if (interaction.customId === `${state.customPrefix}close_list`) {
            paginationStates.delete(interaction.message.id);
            return interaction.message.delete().catch(() => interaction.update({ components: [] }));
        }

        if (interaction.customId === `${state.customPrefix}prev_page` && state.currentPage > 0) {
            state.currentPage--;
        } else if (interaction.customId === `${state.customPrefix}next_page` && state.currentPage < state.totalPages - 1) {
            state.currentPage++;
        }

        const start = state.currentPage * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const currentItems = state.lockedList.slice(start, end);

        const embed = new EmbedBuilder()
            .setColor(0xEE82EE)
            .setTitle(`📋 Canales Bloqueados Localmente (${state.lockedList.length})`)
            .setDescription(
                currentItems.map(item => 
                    `🔒 **${item.pokemon}** (Canal #${item.channelName})\n` +
                    `• Tipo: ${item.type}\n` +
                    `• [Ir al Canal](https://discord.com/channels/${interaction.guild.id}/${item.id})`
                ).join('\n\n')
            )
            .setFooter({ text: `Página ${state.currentPage + 1} de ${state.totalPages}` });

        await interaction.update({ 
            embeds: [embed], 
            components: [generatePaginationButtons(state.currentPage, state.totalPages, state.customPrefix)] 
        }).catch(console.error);
    }
};